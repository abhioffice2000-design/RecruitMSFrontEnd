import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
declare var $: any;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit {
  data = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  };

  // Field errors
  errors: { [key: string]: string } = {};

  // Toast control
  toastMessage = '';
  toastType: 'success' | 'error' = 'error';
  showToastFlag = false;
  private toastTimeout: any;

  // UI state
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;

  constructor(
    private router: Router,
    private ngZone: NgZone,
  ) {}

  private normalizeErrorMessage(err: any): string {
    return String(err?.message || err?.error || err?.responseText || err?.statusText || err || '');
  }

  private isDuplicateUserError(err: any): boolean {
    const msg = this.normalizeErrorMessage(err).toLowerCase();
    // Postgres common patterns:
    if (msg.includes('duplicate key value') || msg.includes('violates unique constraint')) return true;
    // Cordys / app-level common patterns:
    if (msg.includes('already exists')) return true;
    if (msg.includes('user') && msg.includes('exists')) return true;
    if (msg.includes('duplicate') && msg.includes('email')) return true;
    if (msg.includes('unique') && (msg.includes('email') || msg.includes('candidate'))) return true;
    return false;
  }

  ngOnInit(): void {
    // Authenticate SSO in the background so web services don't fail with anonymous access
    if ($ && $.cordys && $.cordys.authentication && $.cordys.authentication.sso) {
      $.cordys.authentication.sso.authenticate('rmst1', '12345678@')
        .done(() => {
          console.log('Background SSO authentication successful (register)');
        })
        .fail((err: any) => {
          console.warn('Background SSO authentication failed:', err);
        });
    }
  }

  // ─── Toast Helpers ────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error' = 'error') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.hideToast();
    }, 3000);
  }

  hideToast() {
    this.showToastFlag = false;
  }

  // ─── UI Helpers ───────────────────────────────────────────
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  clearError(field: string) {
    this.errors[field] = '';
  }

  // ─── Real-time Validators ─────────────────────────────────
  validateEmail() {
    const email = this.data.email.trim();
    if (!email) {
      this.errors['email'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errors['email'] = 'Please enter a valid email address';
    } else {
      this.errors['email'] = '';
    }
  }

  validatePhone() {
    const phone = this.data.phone.replace(/[\s\-]/g, '');
    if (!phone) {
      this.errors['phone'] = 'Phone number is required';
    } else if (!/^\d+$/.test(phone)) {
      this.errors['phone'] = 'Phone number must contain only digits';
    } else if (phone.length !== 10) {
      this.errors['phone'] = 'Phone number must be exactly 10 digits';
    } else {
      this.errors['phone'] = '';
    }
  }

  validatePassword() {
    const pw = this.data.password;
    if (!pw) {
      this.errors['password'] = 'Password is required';
    } else if (pw.length < 8) {
      this.errors['password'] = 'Password must be at least 8 characters';
    } else if (!/\d/.test(pw)) {
      this.errors['password'] = 'Password must contain at least one digit';
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) {
      this.errors['password'] = 'Password must contain at least one symbol';
    } else {
      this.errors['password'] = '';
    }
    // Re-validate confirm if already filled
    if (this.data.confirmPassword) {
      this.validateConfirmPassword();
    }
  }

  validateConfirmPassword() {
    if (!this.data.confirmPassword) {
      this.errors['confirmPassword'] = 'Please confirm your password';
    } else if (this.data.password !== this.data.confirmPassword) {
      this.errors['confirmPassword'] = 'Passwords do not match';
    } else {
      this.errors['confirmPassword'] = '';
    }
  }

  // ─── Validation ───────────────────────────────────────────
  validate(): boolean {
    this.errors = {};
    let valid = true;

    if (!this.data.firstName.trim()) {
      this.errors['firstName'] = 'First name is required';
      valid = false;
    }

    if (!this.data.lastName.trim()) {
      this.errors['lastName'] = 'Last name is required';
      valid = false;
    }

    if (!this.data.email.trim()) {
      this.errors['email'] = 'Email is required';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.data.email)) {
      this.errors['email'] = 'Please enter a valid email address';
      valid = false;
    }

    if (!this.data.phone.trim()) {
      this.errors['phone'] = 'Phone number is required';
      valid = false;
    } else if (!/^\d{10}$/.test(this.data.phone.replace(/[\s\-]/g, ''))) {
      this.errors['phone'] = 'Please enter a valid 10-digit phone number';
      valid = false;
    }

    if (!this.data.password) {
      this.errors['password'] = 'Password is required';
      valid = false;
    } else if (this.data.password.length < 8) {
      this.errors['password'] = 'Password must be at least 8 characters';
      valid = false;
    } else if (!/\d/.test(this.data.password)) {
      this.errors['password'] = 'Password must contain at least one digit';
      valid = false;
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.data.password)) {
      this.errors['password'] = 'Password must contain at least one symbol';
      valid = false;
    }

    if (!this.data.confirmPassword) {
      this.errors['confirmPassword'] = 'Please confirm your password';
      valid = false;
    } else if (this.data.password !== this.data.confirmPassword) {
      this.errors['confirmPassword'] = 'Passwords do not match';
      valid = false;
    }

    return valid;
  }

  // ─── Register ─────────────────────────────────────────────
  onRegister() {
    if (!this.validate()) {
      this.showToast('Please fix the errors below.', 'error');
      return;
    }

    this.isLoading = true;
    const self = this;

    const firstName = this.data.firstName.trim();
    const lastName = this.data.lastName.trim();

    const now = new Date().toISOString();
    const plainPassword = this.data.password;

    // ── Step 1: Insert into ts_candidates ──────────────────
    const candidateSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
      <SOAP:Body>
        <UpdateTs_candidates xmlns="http://schemas.cordys.com/RMST1DatabaseMetadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
          <tuple>
            <new>
              <ts_candidates qAccess="0" qConstraint="0" qInit="0" qValues="">
                <first_name>${firstName}</first_name>
                <last_name>${lastName}</last_name>
                <email>${this.data.email}</email>
                <phone>${this.data.phone}</phone>
                <linkedin_url></linkedin_url>
                <experience_years></experience_years>
                <location></location>
                <created_at>${now}</created_at>
                <created_by>${this.data.email}</created_by>
                <updated_at>${now}</updated_at>
                <updated_by>${this.data.email}</updated_by>
                <temp1></temp1>
                <temp2></temp2>
                <temp3></temp3>
                <temp4></temp4>
                <temp5></temp5>
              </ts_candidates>
            </new>
          </tuple>
        </UpdateTs_candidates>
      </SOAP:Body>
    </SOAP:Envelope>`;

    $.cordys
      .ajax({
        method: 'UpdateTs_candidates',
        namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
        data: candidateSoap,
        dataType: 'xml',
      })
      .done((candidateResponse: any) => {
        // Extract candidate_id from response
        let candidateId = '';
        try {
          if (typeof candidateResponse === 'string') {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(candidateResponse, 'text/xml');
            const idNode = xmlDoc.getElementsByTagName('candidate_id');
            if (idNode.length > 0) {
              candidateId = idNode[0].textContent || '';
            }
          } else {
            const idNode = $(candidateResponse).find('candidate_id');
            if (idNode.length > 0) {
              candidateId = idNode.first().text();
            }
          }
        } catch (e) {
          console.error('Error parsing candidate response:', e);
        }
        console.log('Step 1 done: Candidate inserted with ID', candidateId);

        // ── Step 2: Hash the password ──────────────────────
        const hashSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
          <SOAP:Body>
            <HashPassword xmlns="http://schemas.cordys.com/RMST1DatabaseMetadata" preserveSpace="no" qAccess="0" qValues="">
              <password>${plainPassword}</password>
            </HashPassword>
          </SOAP:Body>
        </SOAP:Envelope>`;

        $.cordys
          .ajax({
            method: 'HashPassword',
            namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
            data: hashSoap,
            dataType: 'xml',
          })
          .done((hashResponse: any) => {
            // Extract hashed password from response
            let hashedPassword = '';
            try {
              if (typeof hashResponse === 'string') {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(hashResponse, 'text/xml');
                const hashNode = xmlDoc.getElementsByTagName('hashPassword');
                // The innermost <hashPassword> contains the actual hash
                if (hashNode.length > 0) {
                  hashedPassword = hashNode[hashNode.length - 1].textContent || '';
                }
              } else {
                // jQuery XML object - traverse the response
                const hashNode = $(hashResponse).find('hashPassword');
                if (hashNode.length > 0) {
                  hashedPassword = hashNode.last().text();
                }
              }
            } catch (e) {
              console.error('Error parsing hash response:', e);
            }

            if (!hashedPassword) {
              self.ngZone.run(() => {
                self.isLoading = false;
                self.showToast('Error hashing password. Please try again.', 'error');
              });
              return;
            }

            console.log('Step 2 done: Password hashed successfully');

            // ── Step 3: Insert into ts_accounts ────────────
            const accountSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
              <SOAP:Body>
                <UpdateTs_accounts xmlns="http://schemas.cordys.com/RMST1DatabaseMetadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
                  <tuple>
                    <new>
                      <ts_accounts qAccess="0" qConstraint="0" qInit="0" qValues="">
                        <email>${self.data.email}</email>
                        <password_hash>${hashedPassword}</password_hash>
                        <account_type>candidate</account_type>
                        <candidate_id>${candidateId}</candidate_id>
                        <account_status>active</account_status>
                        <email_verified>false</email_verified>
                        <failed_login_attempts>0</failed_login_attempts>
                        <last_login></last_login>
                        <password_reset_token></password_reset_token>
                        <password_reset_expiry></password_reset_expiry>
                        <created_at>${now}</created_at>
                        <updated_at>${now}</updated_at>
                        <temp1></temp1>
                        <temp2></temp2>
                        <temp3></temp3>
                        <temp4></temp4>
                        <temp5></temp5>
                      </ts_accounts>
                    </new>
                  </tuple>
                </UpdateTs_accounts>
              </SOAP:Body>
            </SOAP:Envelope>`;

            $.cordys
              .ajax({
                method: 'UpdateTs_accounts',
                namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
                data: accountSoap,
                dataType: 'xml',
              })
              .done((_accountResponse: any) => {
                console.log('Step 3 done: Account created successfully');

                // ── Step 4: Send Registration Email ────────────
                const mailSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <RegistrationMailBPM xmlns="http://schemas.cordys.com/default">
      <usermail>${self.data.email}</usermail>
      <username>${self.data.firstName} ${self.data.lastName}</username>
      <userpass>${plainPassword}</userpass>
    </RegistrationMailBPM>
  </SOAP:Body>
</SOAP:Envelope>`;

                $.cordys
                  .ajax({
                    method: 'RegistrationMailBPM',
                    namespace: 'http://schemas.cordys.com/default',
                    data: mailSoap,
                    dataType: 'xml',
                  })
                  .done((_mailResponse: any) => {
                    console.log('Step 4 done: Registration email sent');
                    self.ngZone.run(() => {
                      self.isLoading = false;
                      self.showToast('Registration successful! Please check your email.', 'success');
                      setTimeout(() => {
                        self.router.navigate(['/login']);
                      }, 1500);
                    });
                  })
                  .fail((mailError: any) => {
                    console.error('Step 4 error (Email failed):', mailError);
                    // ⚠️ IMPORTANT: Do NOT rollback here
                    // User is already created in DB
                    self.ngZone.run(() => {
                      self.isLoading = false;
                      self.showToast('Registered successfully, but email failed.', 'error');
                      setTimeout(() => {
                        self.router.navigate(['/login']);
                      }, 1500);
                    });
                  });
              })
              .fail((error: any) => {
                self.ngZone.run(() => {
                  self.isLoading = false;
                  console.error('Step 3 error (Account insert):', error);
                  if (self.isDuplicateUserError(error)) {
                    self.showToast('Account already exists with this email/phone. Please login.', 'error');
                  } else {
                    self.showToast('Account creation failed. Please contact admin.', 'error');
                  }
                });
              });
          })
          .fail((error: any) => {
            self.ngZone.run(() => {
              self.isLoading = false;
              console.error('Step 2 error (Password hash):', error);
              self.showToast('Password processing failed. Please try again.', 'error');
            });
          });
      })
      .fail((error: any) => {
        self.ngZone.run(() => {
          self.isLoading = false;
          console.error('Step 1 error (Candidate insert):', error);
          if (self.isDuplicateUserError(error)) {
            self.showToast('User already exists with this email/phone. Please login.', 'error');
          } else {
            self.showToast('Registration failed. Please try again or contact admin.', 'error');
          }
        });
      });
  }
          
}