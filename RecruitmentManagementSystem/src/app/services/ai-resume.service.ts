import { Injectable } from '@angular/core';
import { HeroService } from '../hero.service';

declare var $: any;

/**
 * AiResumeService (Gemini Powered)
 * ───────────────
 * Fetches Gemini API config (key, model, URL) from the Cordys XML Store
 * at runtime — no hardcoded secrets in frontend code.
 *
 * Config source: /rmst1/config-env.xml
 *   link1 → API Key
 *   link2 → Model name (e.g. gemini-2.5-flash)
 *   link3 → URL template with ${GEMINI_MODEL} and ${GEMINI_API_KEY} placeholders
 */

// ─── Sub-interfaces for dynamic array fields ──────────────────
export interface ParsedEducation {
  degree: string;
  field_of_study: string;
  institution: string;
  start_year: string;
  end_year: string;
  grade: string;
}

export interface ParsedExperience {
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  description: string;
  is_current: boolean;
}

export interface ParsedInternship {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface ParsedProject {
  title: string;
  description: string;
  technologies: string;
  url: string;
}

export interface ParsedCertification {
  name: string;
  issuing_org: string;
  year: string;
}

export interface ParsedResume {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  experience_years: string;
  skills: { skill_name: string; experience_years: string }[];
  summary: string;

  // ─── New dynamic array fields ──────────────────────
  education: ParsedEducation[];
  experience: ParsedExperience[];
  internships: ParsedInternship[];
  projects: ParsedProject[];
  certifications: ParsedCertification[];

  // ─── New scalar fields ─────────────────────────────
  current_salary: string;
  expected_salary: string;
  notice_period: string;
  highest_qualification: string;
  portfolio_url: string;
  github_url: string;
}

const PARSE_PROMPT = `You are an expert resume parser. Analyze this resume and accurately extract ALL the following fields. Return ONLY a valid JSON object. If a field is not found or is unclear, use an empty string, empty array, or false as appropriate.

Fields to extract:
- first_name (string)
- last_name (string)
- email (string)
- phone (string)
- location (string, e.g., "City, Country" or "City, State")
- linkedin_url (string, full LinkedIn URL if present)
- experience_years (string, total years of professional experience as a number, e.g., "5")
- skills (array of objects: { skill_name: string, experience_years: string })
- summary (string, a brief 1-2 sentence professional summary)

- education (array of objects, one per degree/qualification found):
  Each object: { degree: string, field_of_study: string, institution: string, start_year: string, end_year: string, grade: string }
  Include ALL degrees — BTech, MTech, PhD, MBA, 12th, Diploma, etc.

- experience (array of objects, one per job/company):
  Each object: { company: string, role: string, start_date: string (YYYY-MM or YYYY), end_date: string (YYYY-MM or "Present"), description: string (brief 1-line), is_current: boolean }
  Include current AND all previous companies.

- internships (array of objects):
  Each object: { company: string, role: string, duration: string (e.g. "3 months"), description: string }

- projects (array of objects):
  Each object: { title: string, description: string (brief), technologies: string (comma-separated), url: string }

- certifications (array of objects):
  Each object: { name: string, issuing_org: string, year: string }

- current_salary (string, e.g. "8 LPA" or "" if not mentioned)
- expected_salary (string, e.g. "12 LPA" or "" if not mentioned)
- notice_period (string, e.g. "30 days", "Immediate", or "" if not mentioned)
- highest_qualification (string, the highest degree found, e.g. "PhD", "MTech", "BTech")
- portfolio_url (string, personal website/portfolio link if any)
- github_url (string, GitHub profile link if any)

Respond ONLY with raw JSON. No markdown ticks, no explanation, no introductory text.`;

// ─── Config cache interface ─────────────────────────────────
interface GeminiConfig {
  apiKey: string;
  model: string;
  apiUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AiResumeService {

  private configCache: GeminiConfig | null = null;
  private configLoading: Promise<GeminiConfig> | null = null;

  constructor(private hero: HeroService) {}

  // ─── Fetch config from Cordys XML Store (cached) ────────────
  private async getConfig(): Promise<GeminiConfig> {
    if (this.configCache) return this.configCache;

    // Prevent duplicate parallel fetches
    if (this.configLoading) return this.configLoading;

    this.configLoading = this._fetchConfig();
    try {
      this.configCache = await this.configLoading;
      return this.configCache;
    } finally {
      this.configLoading = null;
    }
  }

  private async _fetchConfig(): Promise<GeminiConfig> {
    const XML_STORE_NS = 'http://schemas.cordys.com/1.0/xmlstore';

    try {
      const resp = await this.hero.ajax('GetXMLObject', XML_STORE_NS, {
        key: '/rmst1/config-env.xml'
      });

      // Log raw response for debugging
      console.log('[AiResume] Raw XML Store response:', JSON.stringify(resp).substring(0, 500));

      let apiKey = '';
      let model = '';
      let urlTemplate = '';

      // ─── Strategy 1: $.cordys.json.find (may work for flat keys) ───
      try {
        const l1 = $.cordys.json.find(resp, 'link1');
        const l2 = $.cordys.json.find(resp, 'link2');
        const l3 = $.cordys.json.find(resp, 'link3');
        if (l1) apiKey = (typeof l1 === 'string') ? l1 : (Array.isArray(l1) ? l1[0] : (l1?.text || ''));
        if (l2) model = (typeof l2 === 'string') ? l2 : (Array.isArray(l2) ? l2[0] : (l2?.text || ''));
        if (l3) urlTemplate = (typeof l3 === 'string') ? l3 : (Array.isArray(l3) ? l3[0] : (l3?.text || ''));
      } catch (e) {
        console.warn('[AiResume] Strategy 1 (cordys.json.find) failed:', e);
      }

      // ─── Strategy 2: Deep object traversal (tuple > old > xml > linkN) ───
      if (!apiKey || !model) {
        try {
          // Cordys JSON response: { tuple: { old: { xml: { link1, link2, link3 } } } }
          const tuple = (resp as any)?.tuple || resp;
          const tupleObj = Array.isArray(tuple) ? tuple[0] : tuple;
          const old = tupleObj?.old || tupleObj;
          const xml = old?.xml || old;

          if (xml?.link1) apiKey = typeof xml.link1 === 'string' ? xml.link1 : (xml.link1?.text || xml.link1?.toString() || '');
          if (xml?.link2) model = typeof xml.link2 === 'string' ? xml.link2 : (xml.link2?.text || xml.link2?.toString() || '');
          if (xml?.link3) urlTemplate = typeof xml.link3 === 'string' ? xml.link3 : (xml.link3?.text || xml.link3?.toString() || '');

          console.log('[AiResume] Strategy 2 result:', { apiKey: apiKey ? '***' + apiKey.slice(-4) : '', model, urlTemplate: urlTemplate ? 'found' : '' });
        } catch (e) {
          console.warn('[AiResume] Strategy 2 (traversal) failed:', e);
        }
      }

      // ─── Strategy 3: JSON.stringify + regex (always works as last resort) ───
      if (!apiKey || !model) {
        try {
          const respStr = JSON.stringify(resp);
          console.log('[AiResume] Strategy 3 — searching in stringified response...');

          const m1 = respStr.match(/"link1"\s*:\s*"([^"]+)"/);
          const m2 = respStr.match(/"link2"\s*:\s*"([^"]+)"/);
          const m3 = respStr.match(/"link3"\s*:\s*"([^"]+)"/);
          if (m1 && !apiKey) apiKey = m1[1];
          if (m2 && !model) model = m2[1];
          if (m3 && !urlTemplate) urlTemplate = m3[1];

          console.log('[AiResume] Strategy 3 result:', { apiKey: apiKey ? '***' + apiKey.slice(-4) : '', model });
        } catch (e) {
          console.warn('[AiResume] Strategy 3 (regex) failed:', e);
        }
      }

      if (!apiKey || !model) {
        console.error('[AiResume] All extraction strategies failed. apiKey:', !!apiKey, 'model:', !!model);
        throw new Error('Missing API key or model in config-env.xml response');
      }

      // Build the final URL by replacing template placeholders
      let apiUrl = urlTemplate || `https://generativelanguage.googleapis.com/v1beta/models/\${GEMINI_MODEL}:generateContent?key=\${GEMINI_API_KEY}`;
      apiUrl = apiUrl.replace('${GEMINI_MODEL}', model).replace('${GEMINI_API_KEY}', apiKey);

      console.log(`[AiResume] Config loaded — Model: ${model}, URL ready.`);
      return { apiKey, model, apiUrl };

    } catch (err) {
      console.error('[AiResume] Failed to load config from XML store:', err);
      throw new Error('Could not load AI configuration. Please ensure config-env.xml is set up in the XML store.');
    }
  }

  // ─── Convert File to Base64 (needed for Gemini InlineData) ───
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl = e.target.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file for conversion'));
      reader.readAsDataURL(file);
    });
  }

  // ─── Read text (fallback for DOC/DOCX) ───────────────────────
  private async fileToText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => resolve(e.target.result as string);
      reader.onerror = () => reject(new Error('Failed to read file as text'));
      reader.readAsText(file);
    });
  }

  // ─── MAIN: Route and Send to Gemini ──────────────────────────
  async parseResume(file: File): Promise<ParsedResume> {
    // Load config from Cordys XML store (cached after first call)
    const config = await this.getConfig();

    let payloadPart: any;

    if (file.type === 'application/pdf') {
      const base64Data = await this.fileToBase64(file);
      payloadPart = {
        inline_data: {
          mime_type: 'application/pdf',
          data: base64Data
        }
      };
    } else {
      const text = await this.fileToText(file);
      if (!text || text.length < 10) {
        throw new Error('Could not extract text from the document. Ensure it is not an image scan.');
      }
      payloadPart = {
        text: "Here is the resume content:\n" + text.substring(0, 15000)
      };
    }

    // Call Gemini API using config from XML store
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PARSE_PROMPT },
              payloadPart
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      let errMsg = err;
      try {
        const errJson = JSON.parse(err);
        errMsg = errJson.error?.message || err;
      } catch (e) { }
      throw new Error(`Gemini API error: ${response.status} — ${errMsg}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    try {
      const raw = JSON.parse(content);

      return {
        first_name: raw.first_name || '',
        last_name: raw.last_name || '',
        email: raw.email || '',
        phone: raw.phone || '',
        location: raw.location || '',
        linkedin_url: raw.linkedin_url || '',
        experience_years: raw.experience_years || '',
        skills: Array.isArray(raw.skills) ? raw.skills : [],
        summary: raw.summary || '',
        education: Array.isArray(raw.education) ? raw.education : [],
        experience: Array.isArray(raw.experience) ? raw.experience : [],
        internships: Array.isArray(raw.internships) ? raw.internships : [],
        projects: Array.isArray(raw.projects) ? raw.projects : [],
        certifications: Array.isArray(raw.certifications) ? raw.certifications : [],
        current_salary: raw.current_salary || '',
        expected_salary: raw.expected_salary || '',
        notice_period: raw.notice_period || '',
        highest_qualification: raw.highest_qualification || '',
        portfolio_url: raw.portfolio_url || '',
        github_url: raw.github_url || '',
      } as ParsedResume;
    } catch {
      throw new Error('Failed to parse AI response as JSON: ' + content);
    }
  }
}
