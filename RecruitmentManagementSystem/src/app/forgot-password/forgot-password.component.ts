import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
declare var $: any;

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent implements OnInit {

  // Step control: 'request' → 'reset' → 'success'
  step: 'request' | 'reset' | 'success' = 'request';

  // Step 1 — Request
  username = '';
  errorUsername = '';

  // Matched account info (stored for password update)
  matchedAccountId = '';

  // Step 2 — Reset
  newPassword = '';
  confirmPassword = '';
  errorNewPassword = '';
  errorConfirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  // Toast
  toastMessage = '';
  toastType: 'success' | 'error' = 'error';
  showToastFlag = false;
  private toastTimeout: any;

  // UI
  isLoading = false;

  constructor(private router: Router, private ngZone: NgZone) {}

  ngOnInit(): void {
    // Authenticate SSO in the background so web services don't fail with anonymous access
    if ($ && $.cordys && $.cordys.authentication && $.cordys.authentication.sso) {
      $.cordys.authentication.sso.authenticate('bhavya.pradhan', 'app@works01')
        .done(() => {
          console.log('Background SSO authentication successful (forgot-password)');
        })
        .fail((err: any) => {
          console.warn('Background SSO authentication failed:', err);
        });
    }
  }

  // ─── Toast ────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error' = 'error') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      this.showToastFlag = false;
    }, 3000);
  }

  hideToast() {
    this.showToastFlag = false;
  }

  // ─── Step 1: Verify email exists in ts_accounts ───────────
  onVerifyUser() {
    this.errorUsername = '';

    if (!this.username.trim()) {
      this.errorUsername = 'Email is required';
      this.showToast('Please enter your email.', 'error');
      return;
    }

    this.isLoading = true;
    const self = this;

    $.cordys.ajax({
      method: 'GetAllAccounts',
      namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
    })
      .done((response: any) => {
        self.ngZone.run(() => {
          self.isLoading = false;

          // Parse all tuples from the response and find matching email
          const enteredEmail = self.username.trim().toLowerCase();
          let found = false;

          try {
            // Get the response node
            const responseNode = response?.GetAllAccountsResponse || response;

            // Extract tuples — could be array or single object
            let tuples = responseNode?.tuple;
            if (!tuples) {
              // Try to find tuples using jQuery
              const $resp = $($.parseXML(
                typeof response === 'string' ? response : new XMLSerializer().serializeToString(response)
              ));
              const accounts: any[] = [];
              $resp.find('ts_accounts').each(function (this: any) {
                accounts.push({
                  email: $(this).find('email').text(),
                  account_id: $(this).find('account_id').text(),
                });
              });

              for (const acc of accounts) {
                if (acc.email.toLowerCase() === enteredEmail) {
                  found = true;
                  self.matchedAccountId = acc.account_id;
                  break;
                }
              }
            } else {
              // JSON-style response
              if (!Array.isArray(tuples)) {
                tuples = [tuples];
              }

              for (const tuple of tuples) {
                const account = tuple?.old?.ts_accounts;
                if (account) {
                  const email = (account.email || '').toLowerCase();
                  if (email === enteredEmail) {
                    found = true;
                    self.matchedAccountId = account.account_id || '';
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error parsing accounts response:', e);
          }

          if (found) {
            self.showToast('Account verified! Please set a new password.', 'success');
            setTimeout(() => {
              self.step = 'reset';
            }, 500);
          } else {
            self.errorUsername = 'Email not found in our records';
            self.showToast('No account found with this email. Please check and try again.', 'error');
          }
        });
      })
      .fail((error: any) => {
        self.ngZone.run(() => {
          self.isLoading = false;
          self.errorUsername = 'Unable to verify account';
          self.showToast('Something went wrong. Please try again later.', 'error');
          console.error('GetAllAccounts error:', error);
        });
      });
  }

  // ─── Step 2: Reset password ───────────────────────────────
  onResetPassword() {
    this.errorNewPassword = '';
    this.errorConfirmPassword = '';
    let valid = true;

    if (!this.newPassword) {
      this.errorNewPassword = 'New password is required';
      valid = false;
    } else if (this.newPassword.length < 6) {
      this.errorNewPassword = 'Password must be at least 6 characters';
      valid = false;
    }

    if (!this.confirmPassword) {
      this.errorConfirmPassword = 'Please confirm your password';
      valid = false;
    } else if (this.newPassword !== this.confirmPassword) {
      this.errorConfirmPassword = 'Passwords do not match';
      valid = false;
    }

    if (!valid) {
      this.showToast('Please fix the errors below.', 'error');
      return;
    }

    this.isLoading = true;
    const self = this;
    const plainPassword = this.newPassword;
    const userEmail = this.username.trim();

    // ── Step 2a: SetPasswordForUser (Cordys SSO password) ──
    const setPasswordSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
      <SOAP:Body>
        <SetPasswordForUser xmlns="http://schemas.cordys.com/user/password/1.0">
          <Username>${userEmail}</Username>
          <NewPassword>${plainPassword}</NewPassword>
        </SetPasswordForUser>
      </SOAP:Body>
    </SOAP:Envelope>`;

    $.cordys.ajax({
      method: 'SetPasswordForUser',
      namespace: 'http://schemas.cordys.com/user/password/1.0',
      data: setPasswordSoap,
      dataType: 'xml',
    })
      .done((_setPassResponse: any) => {
        console.log('Step 2a done: Cordys SSO password updated');

        // ── Step 2b: Hash the new password ──────────────────
        const hashSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
          <SOAP:Body>
            <HashPassword xmlns="http://schemas.cordys.com/RMST1DatabaseMetadata" preserveSpace="no" qAccess="0" qValues="">
              <password>${plainPassword}</password>
            </HashPassword>
          </SOAP:Body>
        </SOAP:Envelope>`;

        $.cordys.ajax({
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
                if (hashNode.length > 0) {
                  hashedPassword = hashNode[hashNode.length - 1].textContent || '';
                }
              } else {
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

            console.log('Step 2b done: Password hashed successfully');

            const now = new Date().toISOString();

            // ── Step 2c: Update ts_accounts with new hash ───
            const updateAccountSoap = `<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
              <SOAP:Body>
                <UpdateTs_accounts xmlns="http://schemas.cordys.com/RMST1DatabaseMetadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
                  <tuple>
                    <old>
                      <ts_accounts qConstraint="0">
                        <account_id>${self.matchedAccountId}</account_id>
                      </ts_accounts>
                    </old>
                    <new>
                      <ts_accounts qAccess="0" qConstraint="0" qInit="0" qValues="">
                        <password_hash>${hashedPassword}</password_hash>
                      </ts_accounts>
                    </new>
                  </tuple>
                </UpdateTs_accounts>
              </SOAP:Body>
            </SOAP:Envelope>`;

            $.cordys.ajax({
              method: 'UpdateTs_accounts',
              namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
              data: updateAccountSoap,
              dataType: 'xml',
            })
              .done((_updateResponse: any) => {
                console.log('Step 2c done: ts_accounts password_hash updated');
                self.ngZone.run(() => {
                  self.isLoading = false;
                  self.step = 'success';
                  self.showToast('Password reset successfully!', 'success');
                });
              })
              .fail((updateError: any) => {
                console.error('Step 2c error (UpdateTs_accounts):', updateError);
                // SSO password was already changed, so still show success
                self.ngZone.run(() => {
                  self.isLoading = false;
                  self.step = 'success';
                  self.showToast('Password updated, but database sync may have failed.', 'success');
                });
              });
          })
          .fail((hashError: any) => {
            console.error('Step 2b error (HashPassword):', hashError);
            // SSO password was already changed, so still show partial success
            self.ngZone.run(() => {
              self.isLoading = false;
              self.step = 'success';
              self.showToast('Password updated, but hash sync failed.', 'success');
            });
          });
      })
      .fail((setPassError: any) => {
        self.ngZone.run(() => {
          self.isLoading = false;
          console.error('Step 2a error (SetPasswordForUser):', setPassError);
          self.showToast('Failed to reset password. Please try again.', 'error');
        });
      });
  }

  // ─── Navigate back to login ───────────────────────────────
  goToLogin() {
    this.router.navigate(['/login']);
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  clearError(field: string) {
    if (field === 'username') this.errorUsername = '';
    if (field === 'newPassword') this.errorNewPassword = '';
    if (field === 'confirmPassword') this.errorConfirmPassword = '';
  }
}
