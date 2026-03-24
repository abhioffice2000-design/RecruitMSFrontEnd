import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Testimonial {
  quote: string;
  name: string;
  title: string;
  company: string;
  image: string;
}

interface JobCard {
  title: string;
  experience: string;
  location: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  // Stats
  statDays = 0;
  statPercent = 0;
  statCompanies = 0;
  statsAnimated = false;

  // Testimonials
  currentTestimonial = 0;
  testimonials: Testimonial[] = [
    {
      quote: "We've hired faster and smarter since switching to Adnate RMS — it's like having a recruiter built into our hiring process",
      name: 'Maya Lin',
      title: 'VP of People',
      company: 'SeedFlow',
      image: 'assets/images/testimonial-person.png',
    },
    {
      quote: 'The quality of candidates we receive through Adnate has been outstanding. Our time-to-hire dropped by 60% in just three months',
      name: 'David Chen',
      title: 'Head of Talent',
      company: 'NovaTech',
      image: 'assets/images/testimonial-person.png',
    },
    {
      quote: "Adnate's matching algorithm is incredibly accurate. Every candidate we interview is genuinely qualified and culture-fit ready",
      name: 'Sarah Martinez',
      title: 'HR Director',
      company: 'BrightWave',
      image: 'assets/images/testimonial-person.png',
    },
    {
      quote: 'The platform streamlined our entire recruitment workflow. We went from chaos to organized hiring in weeks',
      name: 'James Wright',
      title: 'COO',
      company: 'GreenLeaf Inc',
      image: 'assets/images/testimonial-person.png',
    },
    {
      quote: "Best investment we've made in HR tech. The ROI was visible within the first month of implementation",
      name: 'Priya Sharma',
      title: 'Talent Acquisition Lead',
      company: 'Apex Solutions',
      image: 'assets/images/testimonial-person.png',
    },
  ];

  // Job Board
  jobCards: JobCard[] = [
    { title: 'Flight Attendant', experience: '3 yrs experience', location: 'Dubai' },
    { title: 'Hotel Front Desk Supervisor', experience: '2 yrs experience', location: 'Prague' },
    { title: 'Warehouse Operator', experience: '4 yrs experience', location: 'Chicago' },
    { title: 'Restaurant Manager', experience: '9 yrs experience', location: 'Mexico City' },
    { title: 'Pharmaceutical Sales', experience: '5 yrs experience', location: 'Remote / Milan' },
    { title: 'Retail Manager', experience: '8 yrs experience', location: 'Paris' },
    { title: 'Customer Experience Lead', experience: '6 yrs experience', location: 'London' },
    { title: 'Software Engineer', experience: '3 yrs experience', location: 'Bangalore' },
  ];

  // Mobile menu
  mobileMenuOpen = false;

  private autoSlideInterval: any;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.startAutoSlide();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  // ─── Stats Counter Animation ─────────────────────────────
  @HostListener('window:scroll')
  onScroll(): void {
    if (this.statsAnimated) return;
    const statsSection = this.el.nativeElement.querySelector('.stats-section');
    if (!statsSection) return;
    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.8) {
      this.statsAnimated = true;
      this.animateCounter('statDays', 7, 1200);
      this.animateCounter('statPercent', 69, 1500);
      this.animateCounter('statCompanies', 500, 1800);
    }
  }

  private animateCounter(prop: 'statDays' | 'statPercent' | 'statCompanies', target: number, duration: number): void {
    const start = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      (this as any)[prop] = Math.round(start + (target - start) * eased);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  // ─── Testimonial Carousel ────────────────────────────────
  nextTestimonial(): void {
    this.currentTestimonial = (this.currentTestimonial + 1) % this.testimonials.length;
    this.restartAutoSlide();
  }

  prevTestimonial(): void {
    this.currentTestimonial = (this.currentTestimonial - 1 + this.testimonials.length) % this.testimonials.length;
    this.restartAutoSlide();
  }

  private startAutoSlide(): void {
    this.autoSlideInterval = setInterval(() => {
      this.currentTestimonial = (this.currentTestimonial + 1) % this.testimonials.length;
    }, 5000);
  }

  private stopAutoSlide(): void {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }

  private restartAutoSlide(): void {
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  // ─── Mobile Menu ─────────────────────────────────────────
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  scrollTo(sectionId: string): void {
    this.mobileMenuOpen = false;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
