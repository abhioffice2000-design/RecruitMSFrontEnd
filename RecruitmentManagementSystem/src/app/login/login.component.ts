import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isSafeInternalReturnUrl } from '../guards/auth-session';
declare var $: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {

  data = { user: '', pass: '' };

  // Inline validation
  errorUser = '';
  errorPass = '';

  // Toast control
  toastMessage = '';
  toastType: 'success' | 'error' = 'error';
  showToastFlag = false;
  private toastTimeout: any;

  // Show/hide password
  showPassword = false;
  isLoading = false;
  private loginSucceeded = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Override Cordys SDK's default login error handler to use our toast
    if ($ && $.cordys && $.cordys.authentication && $.cordys.authentication.defaults) {
      const self = this;
      $.cordys.authentication.defaults.loginErrorHandler = function (
        e: any,
        statusText: any,
        errorThrown: any
      ) {
        console.log('Cordys login error intercepted:', e, statusText, errorThrown);
        self.ngZone.run(() => {
          self.isLoading = false;
          self.errorUser = 'Invalid credentials';
          self.errorPass = 'Invalid credentials';
          self.showToast('Invalid email or password. Please try again.', 'error');
        });
      };
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

  clearErrors() {
    this.errorUser = '';
    this.errorPass = '';
  }

  // ─── Main Login ───────────────────────────────────────────
  cordysLogin() {
    const self = this;

    this.clearErrors();
    let errors: string[] = [];

    if (!this.data.user) {
      this.errorUser = 'Email is required';
      errors.push('email');
    }

    if (!this.data.pass) {
      this.errorPass = 'Password is required';
      errors.push('password');
    }

    if (errors.length) {
      this.showToast(`Please enter your ${errors.join(' and ')}.`, 'error');
      return;
    }

    this.isLoading = true;

    // Helper function to handle login errors
    const handleLoginError = (error?: any) => {
      console.log('Login error occurred:', error);
      self.ngZone.run(() => {
        self.isLoading = false;
        self.errorUser = 'Invalid credentials';
        self.errorPass = 'Invalid credentials';
        self.showToast('Invalid email or password. Please try again.', 'error');
      });
    };

    // Authenticate via Cordys SSO
    console.log('Attempting login with:', this.data.user);
    const authPromise = $.cordys.authentication.sso.authenticate(
      this.data.user,
      this.data.pass
    );

    authPromise
      .done(function () {
        console.log('Login success, fetching role...');
        self.loginSucceeded = true;
        self.ngZone.run(() => {
          self.fetchRole(self.data.user);
        });
      })
      .fail(handleLoginError);

    if (authPromise.error) {
      authPromise.error(handleLoginError);
    }

    // Fallback timeout in case neither callback fires
    setTimeout(() => {
      if (self.loginSucceeded) return; // Auth already succeeded, skip fallback
      if (
        window.location.pathname === '/' ||
        window.location.pathname === '/login'
      ) {
        if (!self.showToastFlag && self.data.user && self.data.pass) {
          console.log('Fallback timeout — showing error');
          handleLoginError();
        }
      }
    }, 5000);
  }

  // ─── Fetch User Role ──────────────────────────────────────
  fetchRole(username: string) {
    const self = this;
    $.cordys.ajax({
      method: 'GetUserDetails',
      namespace:
        'http://schemas.cordys.com/UserManagement/1.0/Organization',
      parameters: { UserName: username },
    })
      .done((response: any) => {
        self.ngZone.run(() => {
          const roles = self.extractRoles(response).map((r) => r.toUpperCase());
          self.redirectUser(roles, username);
        });
      })
      .fail(() => {
        self.ngZone.run(() => {
          self.isLoading = false;
          self.showToast('Error fetching user role', 'error');
        });
      });
  }

  // ─── Extract Roles from Response ──────────────────────────
  extractRoles(resp: any): string[] {
    const roles: string[] = [];
    const roleNode =
      resp?.GetUserDetailsResponse?.User?.Roles?.Role ||
      resp?.User?.Roles?.Role ||
      resp?.Roles?.Role;

    if (Array.isArray(roleNode)) {
      roleNode.forEach((r: any) =>
        roles.push(
          typeof r === 'string' ? r.trim() : r['#text'] || r?.text || ''
        )
      );
    } else if (roleNode) {
      roles.push(
        typeof roleNode === 'string'
          ? roleNode.trim()
          : roleNode['#text'] || roleNode?.text || ''
      );
    }

    return roles;
  }

  // ─── Role-Based Redirect ─────────────────────────────────
  redirectUser(roles: string[], username: string) {
    try {
      sessionStorage.setItem(
        'loggedInRoles',
        JSON.stringify(roles.map((r) => r.toUpperCase()))
      );
    } catch {
      /* ignore */
    }
    sessionStorage.setItem('loggedInUser', username);
    // BPM DN + HR flows use the same email as Cordys login (s_accounts.email / org user cn).
    // fetchAndStoreUserId() was never called elsewhere; without this, loggedInUserEmail stays empty.
    sessionStorage.setItem('loggedInUserEmail', username);
    const self = this;

    // Fetch the user details by email to determine true account_type
    $.cordys.ajax({
      method: 'Getuserdetailsbymail',
      namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
      dataType: '* json',
      parameters: { emailid: username }
    })
      .done((resp: any) => {
        self.ngZone.run(() => {
          let accountType = '';
          try {
            const tuples = $.cordys.json.find(resp, 'tuple');
            if (tuples) {
              const tuple = Array.isArray(tuples) ? tuples[0] : tuples;
              const account = tuple?.old?.ts_accounts || tuple?.ts_accounts || tuple?.old || tuple;
              accountType = typeof account?.account_type === 'string' ? account.account_type.toLowerCase() : (account?.account_type?.text?.toLowerCase() || '');

              // Store Candidate ID
              const candidateIdStr = account?.candidate_id;
              const candidateId = (candidateIdStr && typeof candidateIdStr === 'object' && candidateIdStr['@null'] === 'true') ? '' : (candidateIdStr || '');
              if (candidateId) {
                const finalCid = typeof candidateId === 'string' ? candidateId : candidateId.text || '';
                sessionStorage.setItem('loggedInCandidateId', finalCid);
                console.log('[Login] Stored loggedInCandidateId:', finalCid);
              }

              // Store User ID and Department
              const userIdStr = account?.user_id;
              const userId = (userIdStr && typeof userIdStr === 'object' && userIdStr['@null'] === 'true') ? '' : (userIdStr || '');
              if (userId) {
                const validUserId = typeof userId === 'string' ? userId : userId.text || '';
                sessionStorage.setItem('loggedInUserId', validUserId);
                self.fetchAndStoreDepartmentId(validUserId);
              }
            }
          } catch (e) { console.warn('Error parsing user details in redirectUser:', e); }

          // 1. Force candidate portal if account_type is candidate
          if (accountType === 'candidate') {
            const roleSet = new Set(roles.map((r) => r.toUpperCase()));
            roleSet.add('CANDIDATE_RMST1');
            try {
              sessionStorage.setItem(
                'loggedInRoles',
                JSON.stringify([...roleSet])
              );
            } catch {
              /* ignore */
            }
            self.doRedirect('/candidate/dashboard', 'Candidate Portal');
            return;
          }

          // 2. Fallback to Cordys roles if not a candidate account
          const roleRouteMap: { role: string; route: string; label: string }[] = [
            { role: 'ADMIN_RMST1', route: '/admin', label: 'Admin Dashboard' },
            { role: 'HR_RMST1', route: '/hr', label: 'HR Dashboard' },
            { role: 'INTERVIEWER_RMST1', route: '/interviewer', label: 'Interviewer Portal' },
            { role: 'MANAGER_RMST1', route: '/manager/dashboard', label: 'Manager Dashboard' },
            { role: 'CANDIDATE_RMST1', route: '/candidate/dashboard', label: 'Candidate Portal' },
          ];

          for (const entry of roleRouteMap) {
            if (roles.includes(entry.role)) {
              self.doRedirect(entry.route, entry.label);
              return;
            }
          }

          self.isLoading = false;
          self.showToast('Unauthorized user — no valid role assigned.', 'error');
        });
      })
      .fail(() => {
        self.ngZone.run(() => {
          self.isLoading = false;
          self.showToast('Failed to verify user account details.', 'error');
        });
      });
  }

  private doRedirect(route: string, label: string) {
    try {
      sessionStorage.setItem('loggedInPortalLabel', label);
    } catch {
      /* ignore */
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const target =
      returnUrl && isSafeInternalReturnUrl(returnUrl) ? returnUrl : route;
    this.showToast(`Login successful. Redirecting to ${label}...`, 'success');
    setTimeout(() => {
      this.router.navigateByUrl(target).then((success) => {
        console.log(`Navigation to ${target}:`, success ? 'successful' : 'failed');
      });
    }, 800);
  }


  // ─── Fetch user details by email ────────────────
  private fetchAndStoreUserId(email: string) {
    const self = this;
    $.cordys.ajax({
      method: 'Getuserdetailsbymail',
      namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
      dataType: '* json',
      parameters: { emailid: email }
    })
      .done(function (resp: any) {
        try {
          const tuples = $.cordys.json.find(resp, 'tuple');
          if (tuples) {
            const tuple = Array.isArray(tuples) ? tuples[0] : tuples;
            const account = tuple?.old?.ts_accounts || tuple?.ts_accounts || tuple?.old || tuple;

            const userIdStr = account?.user_id;
            // check if null object from Cordys XML-to-JSON
            const userId = (userIdStr && typeof userIdStr === 'object' && userIdStr['@null'] === 'true') ? '' : (userIdStr || '');

            const candidateIdStr = account?.candidate_id;
            const candidateId = (candidateIdStr && typeof candidateIdStr === 'object' && candidateIdStr['@null'] === 'true') ? '' : (candidateIdStr || '');

            let validUserId = '';
            if (userId) {
              validUserId = typeof userId === 'string' ? userId : userId.text || '';
              sessionStorage.setItem('loggedInUserId', validUserId);
              console.log('[Login] Stored loggedInUserId:', sessionStorage.getItem('loggedInUserId'));

              // Fetch department_id from ts_users since it's a valid employee user
              self.fetchAndStoreDepartmentId(validUserId);
            } else {
              console.warn('[Login] user_id is null/empty for this account.');
            }

            if (candidateId) {
              sessionStorage.setItem('loggedInCandidateId', typeof candidateId === 'string' ? candidateId : candidateId.text || '');
              console.log('[Login] Stored loggedInCandidateId:', sessionStorage.getItem('loggedInCandidateId'));
            }

            // Store raw email as well, just in case
            sessionStorage.setItem('loggedInUserEmail', email);

          } else {
            console.warn('[Login] No tuples found for email:', email);
          }
        } catch (e) {
          console.warn('[Login] Error parsing user lookup response:', e);
        }
      })
      .fail(function () {
        console.warn('[Login] Failed to fetch user details by email');
      });
  }

  // ─── Fetch department_id from ts_users ────────────────
  private fetchAndStoreDepartmentId(userId: string) {
    $.cordys.ajax({
      method: 'GetTs_usersObject',
      namespace: 'http://schemas.cordys.com/RMST1DatabaseMetadata',
      dataType: '* json',
      parameters: { User_id: userId }
    })
      .done(function (resp: any) {
        try {
          const tuples = $.cordys.json.find(resp, 'tuple');
          if (tuples) {
            const tuple = Array.isArray(tuples) ? tuples[0] : tuples;
            const user = tuple?.old?.ts_users || tuple?.ts_users || tuple?.old || tuple;
            const deptId = user?.department_id || '';
            if (deptId) {
              const finalDeptId = typeof deptId === 'string' ? deptId : deptId.text || '';
              if (finalDeptId && (!finalDeptId['@null'])) {
                sessionStorage.setItem('loggedInUserDepartmentId', finalDeptId);
                console.log('[Login] Stored loggedInUserDepartmentId:', finalDeptId);
              }
            }
          }
        } catch (e) {
          console.warn('[Login] Error parsing ts_users to get department:', e);
        }
      })
      .fail(function (e: any) {
        console.warn('[Login] Failed to fetch user department details', e);
      });
  }
}
