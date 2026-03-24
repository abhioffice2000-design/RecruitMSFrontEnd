import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoapService } from '../../services/soap.service';

export enum UserRole {
  ADMIN = 'ADMIN',
  HR = 'HR',
  INTERVIEWER = 'INTERVIEWER',
  LEADERSHIP = 'LEADERSHIP',
  MANAGER = 'MANAGER'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.scss'],
})
export class UserManagement implements OnInit {
  activeTab = 'managers';
  showAddModal = false;
  modalType = '';
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  isSaving = false;
  isEditMode = false;
  selectedEntry: any = null;

  // Reset Password Modal
  showResetPasswordModal = false;
  resetPasswordUser: any = null;
  resetPasswordData = { newPassword: '', confirmPassword: '' };
  isResettingPassword = false;

  newEntry: any = {};

  // Expose enum to template
  readonly UserRole = UserRole;
  roleOptions = [
    { label: 'Manager', value: UserRole.MANAGER },
    { label: 'HR Personnel', value: UserRole.HR },
    { label: 'Interviewer', value: UserRole.INTERVIEWER }
  ];
  dbDepartments: Record<string, string>[] = [];

  managers: any[] = [];
  hrMembers: any[] = [];
  interviewers: any[] = [];
  departments: any[] = [];

  // Search
  searchQuery: string = '';

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;

  onSearchChange() {
    this.currentPage = 1;
  }

  getPaginatedData(data: any[]) {
    if (!data) return [];
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return data.slice(startIndex, startIndex + this.itemsPerPage);
  }

  getTotalPages(data: any[]) {
    if (!data) return 0;
    return Math.ceil(data.length / this.itemsPerPage);
  }

  nextPage(data: any[]) {
    if (this.currentPage < this.getTotalPages(data)) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
  }

  getPaginationText(data: any[]) {
    if (!data || data.length === 0) return 'No entries found';
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, data.length);
    return `Showing ${start} to ${end} of ${data.length} entries`;
  }

  get filteredManagers() {
    if (!this.searchQuery) return this.managers;
    const q = this.searchQuery.toLowerCase();
    return this.managers.filter(m =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.department && m.department.toLowerCase().includes(q))
    );
  }

  get filteredHRMembers() {
    if (!this.searchQuery) return this.hrMembers;
    const q = this.searchQuery.toLowerCase();
    return this.hrMembers.filter(h =>
      h.id.toLowerCase().includes(q) ||
      h.name.toLowerCase().includes(q) ||
      h.email.toLowerCase().includes(q) ||
      (h.department && h.department.toLowerCase().includes(q))
    );
  }

  get filteredDepartments() {
    if (!this.searchQuery) return this.departments;
    const q = this.searchQuery.toLowerCase();
    return this.departments.filter(d =>
      d.id.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.head.toLowerCase().includes(q)
    );
  }

  get filteredInterviewers() {
    if (!this.searchQuery) return this.interviewers;
    const q = this.searchQuery.toLowerCase();
    return this.interviewers.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      (i.department && i.department.toLowerCase().includes(q))
    );
  }

  private getCordysRoleName(role: UserRole): string {
    switch (role) {
      case UserRole.MANAGER: return 'Manager_RMST1';
      case UserRole.HR: return 'HR_RMST1';
      case UserRole.INTERVIEWER: return 'Interviewer_RMST1';
      case UserRole.LEADERSHIP: return 'Leadership_RMST1';
      case UserRole.ADMIN: return 'Admin_RMST1';
      default: return 'Manager_RMST1';
    }
  }

  private async purgeExistingRoles(userName: string, skipRole: string) {
    try {
      // Get role info from Cordys. We expect a flattened array but will handle raw response also for robustness.
      const resp = await this.soapService.getUserRolesDetail("rubio") as any;
      console.log(`[UserMgmt] Cordys role check for ${userName}:`, resp);

      let roles: any;
      if (Array.isArray(resp)) {
        roles = resp;
      } else {
        // Fallback: Manually navigate the GetUserDetailsResponse structure provided by user
        // This handles cases where SoapService might return the raw object
        roles = resp?.User?.Roles?.Role || resp?.Roles?.Role || resp?.Role || resp;
      }

      if (!roles) {
        console.log(`[UserMgmt] No roles found to purge for ${userName}`);
        return;
      }

      const roleArr = Array.isArray(roles) ? roles : [roles];

      // Extract the actual string identifiers (Names or DNs) from the objects
      const currentRoleNames: string[] = roleArr.map((r: any) => {
        if (typeof r === 'string') return r;
        return r['#text'] || r['name'] || r['@name'] || r['Description'] || '';
      }).filter(name => !!name);

      console.log(`[UserMgmt] Parsed role names for ${userName}:`, currentRoleNames);

      if (currentRoleNames.length > 0) {
        this.showToastMessage(`Found ${currentRoleNames.length} roles in Cordys.`);
      }

      const rolesToPurge = [
        'Manager_RMST1', 'HR_RMST1', 'Interviewer_RMST1',
        'Admin_RMST1', 'Leadership_RMST1'
      ].filter(r => r !== skipRole);

      for (const roleString of currentRoleNames) {
        // Check if this Cordys role matches any of our managed role names
        const matchedManagedRole = rolesToPurge.find(managedRole =>
          roleString === managedRole || roleString.includes(`cn=${managedRole},`) || roleString.includes(managedRole)
        );

        if (matchedManagedRole) {
          console.log(`[UserMgmt] Matched "${matchedManagedRole}" within "${roleString}". Purging...`);
          try {
            // Aggressive removal attempt
            await this.soapService.removeRoleFromUser(userName, roleString);

            // Also try removing by short name if it's different
            if (roleString !== matchedManagedRole) {
              await this.soapService.removeRoleFromUser(userName, matchedManagedRole);
            }
            this.showToastMessage(`Removed old role: ${matchedManagedRole}`);
          } catch (e) {
            console.warn(`[UserMgmt] Failed to remove role ${roleString}:`, e);
          }
        }
      }
    } catch (err) {
      console.error('[UserMgmt] Failed to purge roles:', err);
    }
  }

  constructor(private soapService: SoapService) { }

  ngOnInit() {
    this.fetchInitialData();
  }

  private async fetchInitialData() {
    try {
      // 1. Fetch managers first so we can resolve names for department heads
      await this.fetchManagers();
      // 2. Fetch departments
      await this.loadDepartmentsData();
      // 3. Fetch others in parallel
      this.fetchHRMembers();
      this.fetchInterviewers();
    } catch (err) {
      console.error('Failed to initialize dashboard data:', err);
    }
  }

  fetchAllData() {
    this.fetchInitialData();
  }

  loadDepartmentsData(): Promise<void> {
    return this.soapService.getAllDepartments().then(depts => {
      this.dbDepartments = depts;
      this.departments = depts.map(d => {
        const headId = d['temp1'] || '';
        const headManager = this.managers.find(m => m.id === headId);
        return {
          id: d['department_id'],
          name: d['department_name'],
          head: headManager ? headManager.name : (headId || 'TBD'),
          headId: headId,
          employees: 0,
          status: UserStatus.ACTIVE,
          _raw: d
        };
      });
    }).catch(err => {
      console.error('Failed to load departments:', err);
    });
  }

  fetchManagers(): Promise<void> {
    return this.soapService.getAllManagers().then(data => {
      this.managers = data.map(m => {
        const deptId = m['department_id'] || m['Department_id'];
        const deptObj = this.dbDepartments.find((d: any) => d['department_id'] === deptId);
        return {
          id: m['user_id'] || m['User_id'] || ('MGR-' + Math.floor(Math.random() * 900 + 100)),
          firstName: m['first_name'] || m['First_name'] || '',
          lastName: m['last_name'] || m['Last_name'] || '',
          name: (m['first_name'] || m['First_name'] || '') + ' ' + (m['last_name'] || m['Last_name'] || ''),
          email: m['email'] || m['Email'] || '',
          departmentId: deptId,
          department: deptObj ? deptObj['department_name'] : (m['department_id'] || m['Department_id'] || 'N/A'),
          status: m['status'] || m['Status'] || UserStatus.ACTIVE,
          _raw: m
        };
      });
    }).catch(err => {
      console.error('Failed to fetch managers:', err);
    });
  }

  fetchHRMembers(): Promise<void> {
    return this.soapService.getAllHR().then(data => {
      this.hrMembers = data.map(m => {
        const deptId = m['department_id'] || m['Department_id'];
        const deptObj = this.dbDepartments.find((d: any) => d['department_id'] === deptId);
        return {
          id: m['user_id'] || m['User_id'] || ('HR-' + Math.floor(Math.random() * 900 + 100)),
          firstName: m['first_name'] || m['First_name'] || '',
          lastName: m['last_name'] || m['Last_name'] || '',
          name: (m['first_name'] || m['First_name'] || '') + ' ' + (m['last_name'] || m['Last_name'] || ''),
          email: m['email'] || m['Email'] || '',
          departmentId: deptId,
          department: deptObj ? deptObj['department_name'] : (m['department_id'] || m['Department_id'] || 'N/A'),
          status: m['status'] || m['Status'] || UserStatus.ACTIVE,
          _raw: m
        };
      });
    }).catch(err => {
      console.error('Failed to fetch HR members:', err);
    });
  }

  fetchInterviewers(): Promise<void> {
    return this.soapService.getAllInterviewers().then(data => {
      this.interviewers = data.map(m => {
        const deptId = m['department_id'] || m['Department_id'];
        const deptObj = this.dbDepartments.find((d: any) => d['department_id'] === deptId);
        return {
          id: m['user_id'] || m['User_id'] || ('INT-' + Math.floor(Math.random() * 900 + 100)),
          firstName: m['first_name'] || m['First_name'] || '',
          lastName: m['last_name'] || m['Last_name'] || '',
          name: (m['first_name'] || m['First_name'] || '') + ' ' + (m['last_name'] || m['Last_name'] || ''),
          email: m['email'] || m['Email'] || '',
          departmentId: deptId,
          department: deptObj ? deptObj['department_name'] : (m['department_id'] || m['Department_id'] || 'N/A'),
          status: m['status'] || m['Status'] || UserStatus.ACTIVE,
          _raw: m
        };
      });
    }).catch(err => {
      console.error('Failed to fetch interviewers:', err);
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 1; // Reset to page 1
    this.refreshActiveTab();
  }

  private refreshActiveTab() {
    switch (this.activeTab) {
      case 'managers': this.fetchManagers(); break;
      case 'hr': this.fetchHRMembers(); break;
      case 'interviewers': this.fetchInterviewers(); break;
    }
  }

  openAddModal(type: string) {
    this.modalType = type;
    this.showAddModal = true;
    this.isEditMode = false;
    this.selectedEntry = null;
    this.newEntry = {};

    // Fetch departments for dropdowns if needed
    this.ensureDepartmentsFetched();
  }

  openEditModal(type: string, item: any) {
    this.modalType = type;
    this.isEditMode = true;
    this.selectedEntry = item;

    // Map item properties to form fields (newEntry)
    if (type === 'department') {
      this.newEntry = {
        name: item.name,
        managerId: item.headId || ''
      };
    } else {
      this.newEntry = {
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        department: item.departmentId,
        status: item.status,
        role: item._raw.role || item._raw.Role
      };
    }

    this.showAddModal = true;
    this.ensureDepartmentsFetched();
  }

  private ensureDepartmentsFetched() {
    if (this.dbDepartments.length === 0) {
      this.soapService.getAllDepartments().then(depts => {
        this.dbDepartments = depts;
      }).catch(err => {
        console.error('Failed to fetch departments:', err);
      });
    }
  }

  closeModal() {
    this.showAddModal = false;
    this.newEntry = {};
  }

  private showToastMessage(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  saveEntry() {
    if (this.isEditMode) {
      this.updateEntry();
      return;
    }

    // Department save uses Cordys SOAP – handled separately
    if (this.modalType === 'department') {
      this.saveDepartment();
      return;
    }

    // Manager save uses Cordys SOAP – handled separately
    if (this.modalType === 'manager') {
      this.saveManager();
      return;
    }

    if (this.modalType === 'hr') {
      this.saveHRMember();
      return;
    }

    if (this.modalType === 'interviewer') {
      this.saveInterviewer();
      return;
    }

    // Default legacy validation for other types
    if (!this.newEntry.name || !this.newEntry.email) return;

    this.closeModal();
  }

  updateEntry() {
    switch (this.modalType) {
      case 'manager': this.updateManager(); break;
      case 'hr': this.updateHRMember(); break;
      case 'interviewer': this.updateInterviewer(); break;
      case 'department': this.updateDepartment(); break;
    }
  }

  private async updateManager() {
    if (!this.newEntry.firstName || !this.newEntry.lastName || !this.newEntry.email) {
      this.showToastMessage('Please fill all required fields.', 'error');
      return;
    }

    this.isSaving = true;
    try {
      const oldRaw = this.selectedEntry._raw;
      const newData = {
        first_name: this.newEntry.firstName,
        last_name: this.newEntry.lastName,
        email: this.newEntry.email,
        role: this.newEntry.role || UserRole.MANAGER,
        status: this.newEntry.status || oldRaw.status,
        department_id: this.newEntry.department,
        updated_by: 'admin'
      };

      await this.soapService.updateUser(oldRaw, newData);

      // ─── Cordys Role Assignment ──────────────────────────
      const oldRoleEnum = (oldRaw.role || oldRaw.Role) as UserRole;
      if (newData.role !== oldRoleEnum) {
        const cordysUsername = newData.email.split('@')[0];
        const newCordysRole = this.getCordysRoleName(newData.role);

        console.log(`[UserMgmt] Role changing. Purging and Re-assigning for ${cordysUsername}...`);
        try {
          // Purge all managed roles except the new one
          await this.purgeExistingRoles(cordysUsername, newCordysRole);
          // Then assign new role
          await this.soapService.assignRoleToUser(cordysUsername, newCordysRole);
        } catch (roleErr) {
          console.error('[UserMgmt] Failed to sync Cordys roles:', roleErr);
        }
      }

      // If role changed, refresh all lists as the user moves to a different tab
      if (newData.role !== UserRole.MANAGER) {
        this.fetchAllData();
      } else {
        // Update local list
        const idx = this.managers.findIndex(m => m.id === this.selectedEntry.id);
        if (idx > -1) {
          const deptObj = this.dbDepartments.find(d => d['department_id'] === this.newEntry.department);
          this.managers[idx] = {
            ...this.selectedEntry,
            firstName: newData.first_name,
            lastName: newData.last_name,
            name: newData.first_name + ' ' + newData.last_name,
            email: newData.email,
            departmentId: newData.department_id,
            department: deptObj ? deptObj['department_name'] : 'N/A',
            status: newData.status,
            _raw: { ...oldRaw, ...newData }
          };
        }
      }

      this.closeModal();
      this.showToastMessage('Manager updated successfully!');
    } catch (err) {
      console.error('Failed to update manager:', err);
      this.showToastMessage('Failed to update manager.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  private async updateHRMember() {
    if (!this.newEntry.firstName || !this.newEntry.lastName || !this.newEntry.email) {
      this.showToastMessage('Please fill all required fields.', 'error');
      return;
    }

    this.isSaving = true;
    try {
      const oldRaw = this.selectedEntry._raw;
      const newData = {
        first_name: this.newEntry.firstName,
        last_name: this.newEntry.lastName,
        email: this.newEntry.email,
        role: this.newEntry.role || UserRole.HR,
        status: this.newEntry.status || oldRaw.status,
        department_id: '',
        updated_by: 'admin'
      };

      await this.soapService.updateUser(oldRaw, newData);

      const oldRoleEnum = (oldRaw.role || oldRaw.Role) as UserRole;
      if (newData.role !== oldRoleEnum) {
        const cordysUsername = newData.email.split('@')[0];
        const newCordysRole = this.getCordysRoleName(newData.role);
        try {
          // Purge all managed roles except the new one
          await this.purgeExistingRoles(cordysUsername, newCordysRole);
          // Then assign new role
          await this.soapService.assignRoleToUser(cordysUsername, newCordysRole);
        } catch (roleErr) {
          console.error('[UserMgmt] Failed to sync Cordys roles:', roleErr);
        }
      }

      if (newData.role !== UserRole.HR) {
        this.fetchAllData();
      } else {
        const idx = this.hrMembers.findIndex(h => h.id === this.selectedEntry.id);
        if (idx > -1) {
          this.hrMembers[idx] = {
            ...this.selectedEntry,
            firstName: newData.first_name,
            lastName: newData.last_name,
            name: newData.first_name + ' ' + newData.last_name,
            email: newData.email,
            status: newData.status,
            _raw: { ...oldRaw, ...newData }
          };
        }
      }

      this.closeModal();
      this.showToastMessage('HR Member updated successfully!');
    } catch (err) {
      console.error('Failed to update HR member:', err);
      this.showToastMessage('Failed to update HR member.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  private async updateInterviewer() {
    if (!this.newEntry.firstName || !this.newEntry.lastName || !this.newEntry.email) {
      this.showToastMessage('Please fill all required fields.', 'error');
      return;
    }

    this.isSaving = true;
    try {
      const oldRaw = this.selectedEntry._raw;
      const newData = {
        first_name: this.newEntry.firstName,
        last_name: this.newEntry.lastName,
        email: this.newEntry.email,
        role: this.newEntry.role || UserRole.INTERVIEWER,
        status: this.newEntry.status || oldRaw.status,
        department_id: '',
        updated_by: 'admin',
        temp1: this.newEntry.expertise || oldRaw.temp1
      };

      await this.soapService.updateUser(oldRaw, newData);

      const oldRoleEnum = (oldRaw.role || oldRaw.Role) as UserRole;
      if (newData.role !== oldRoleEnum) {
        const cordysUsername = newData.email.split('@')[0];
        const newCordysRole = this.getCordysRoleName(newData.role);
        try {
          await this.purgeExistingRoles(cordysUsername, newCordysRole);
          await this.soapService.assignRoleToUser(cordysUsername, newCordysRole);
        } catch (roleErr) {
          console.error('[UserMgmt] Failed to sync Cordys roles:', roleErr);
        }
      }

      if (newData.role !== UserRole.INTERVIEWER) {
        this.fetchAllData();
      } else {
        const idx = this.interviewers.findIndex(i => i.id === this.selectedEntry.id);
        if (idx > -1) {
          this.interviewers[idx] = {
            ...this.selectedEntry,
            firstName: newData.first_name,
            lastName: newData.last_name,
            name: newData.first_name + ' ' + newData.last_name,
            email: newData.email,
            expertise: newData.temp1,
            status: newData.status,
            _raw: { ...oldRaw, ...newData }
          };
        }
      }

      this.closeModal();
      this.showToastMessage('Interviewer updated successfully!');
    } catch (err) {
      console.error('Failed to update interviewer:', err);
      this.showToastMessage('Failed to update interviewer.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  private async updateDepartment() {
    if (!this.newEntry.name) {
      this.showToastMessage('Department name is required.', 'error');
      return;
    }

    this.isSaving = true;
    try {
      const oldData = {
        department_id: this.selectedEntry.id,
        department_name: this.selectedEntry.name,
        temp1: this.selectedEntry.headId || ''
      };
      const newData = {
        department_name: this.newEntry.name,
        manager_id: this.newEntry.managerId || '',
        updated_by: 'admin'
      };

      await this.soapService.updateDepartment(oldData, newData);

      const idx = this.departments.findIndex(d => d.id === this.selectedEntry.id);
      if (idx > -1) {
        const headManager = this.managers.find(m => m.id === newData.manager_id);
        this.departments[idx] = {
          ...this.selectedEntry,
          name: newData.department_name,
          head: headManager ? headManager.name : (newData.manager_id || 'TBD'),
          headId: newData.manager_id
        };
      }

      this.closeModal();
      this.showToastMessage('Department updated successfully!');
    } catch (err) {
      console.error('Failed to update department:', err);
      this.showToastMessage('Failed to update department.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  /** Save a new manager via Cordys SOAP: 1) Create user in Cordys Organization  2) Insert user in DB */
  private async saveManager() {
    if (!this.newEntry.firstName || !this.newEntry.lastName || !this.newEntry.email || !this.newEntry.password) {
      this.showToastMessage('Please fill all required fields.', 'error');
      return;
    }

    if (this.newEntry.password !== this.newEntry.confirmPassword) {
      this.showToastMessage('Passwords do not match.', 'error');
      return;
    }

    if (!this.newEntry.department || this.newEntry.department === '') {
      this.showToastMessage('Please select a department.', 'error');
      return;
    }

    this.isSaving = true;

    // Capture values before closeModal() clears newEntry
    const firstName = this.newEntry.firstName;
    const lastName = this.newEntry.lastName;
    const email = this.newEntry.email;
    const password = this.newEntry.password;
    const departmentId = this.newEntry.department;

    // Construct Cordys Username from email (part before @)
    const emailPrefix = email.split('@')[0];
    const cordysUsername = emailPrefix; // For CreateUserInOrganization, we use simple username, not full DN

    try {
      // Step 1: Create user in Cordys Organization and assign Manager_RMST1 role
      await this.soapService.createUserInOrganization({
        userName: cordysUsername,
        description: `${firstName} ${lastName}`,
        password: password,
        role: 'Manager_RMST1'
      });

      // Step 2: Insert user into ts_users table (only if Step 1 succeeds)
      const dbResult = await this.soapService.insertUser({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password_hash: password,
        role: UserRole.MANAGER,
        status: UserStatus.ACTIVE,
        department_id: departmentId,
        created_by: 'admin'
      });

      // Find department name for local list
      const deptObj = this.dbDepartments.find(d => d['department_id'] === departmentId);
      const departmentName = deptObj ? deptObj['department_name'] : 'Unknown';

      // Update local UI list
      this.managers.unshift({
        id: dbResult?.user_id || dbResult?.User_id || ('MGR-' + Math.floor(Math.random() * 900 + 100)),
        name: firstName + ' ' + lastName,
        email: email,
        department: departmentName,
        status: UserStatus.ACTIVE
      });

      this.closeModal();
      this.showToastMessage(`Manager "${firstName} ${lastName}" registered successfully!`);

    } catch (err: any) {
      console.error('Failed to register manager:', err);
      const errorDetail = err?.responseText || err?.jqXHR?.responseText || 'Cordys returned an error.';
      this.showToastMessage(`Failed to register manager: ${errorDetail}`, 'error');
    } finally {
      this.isSaving = false;
    }
  }

  /** Save a new HR member via Cordys SOAP */
  private async saveHRMember() {
    if (!this.newEntry.firstName || !this.newEntry.lastName || !this.newEntry.email || !this.newEntry.password) {
      this.showToastMessage('Please fill all required fields.', 'error');
      return;
    }

    if (this.newEntry.password !== this.newEntry.confirmPassword) {
      this.showToastMessage('Passwords do not match.', 'error');
      return;
    }

    this.isSaving = true;

    const firstName = this.newEntry.firstName;
    const lastName = this.newEntry.lastName;
    const email = this.newEntry.email;
    const password = this.newEntry.password;
    const departmentId = ''; // Removed from form
    const specialization = ''; // Removed from form

    const cordysUsername = email.split('@')[0];

    console.log('[UserManagement] Registering HR in Cordys:', {
      userName: cordysUsername,
      role: 'HR_RMST1'
    });

    try {
      await this.soapService.createUserInOrganization({
        userName: cordysUsername,
        description: `${firstName} ${lastName}`,
        password: password,
        role: 'HR_RMST1'
      });

      console.log('[UserManagement] Registering HR in DB...', { firstName, lastName, email, role: UserRole.HR });

      // Attempt to find a "Human Resources" or "HR" department to assign
      const hrDept = this.dbDepartments.find(d =>
        (d['department_name'] || '').toLowerCase().includes('hr') ||
        (d['department_name'] || '').toLowerCase().includes('human resources')
      );
      const targetDeptId = hrDept ? hrDept['department_id'] : '';

      const dbResult = await this.soapService.insertUser({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password_hash: password,
        role: UserRole.HR,
        status: UserStatus.ACTIVE,
        department_id: targetDeptId,
        created_by: 'admin'
      });
      console.log('[UserManagement] HR DB Result:', dbResult);

      // Update local UI list
      this.hrMembers.unshift({
        id: dbResult?.user_id || dbResult?.User_id || ('HR-' + Math.floor(Math.random() * 900 + 100)),
        name: firstName + ' ' + lastName,
        email: email,
        department: 'N/A',
        specialization: 'N/A',
        status: UserStatus.ACTIVE
      });

      this.closeModal();
      this.showToastMessage(`HR Member "${firstName} ${lastName}" registered successfully!`);

    } catch (err: any) {
      console.error('Failed to register HR member:', err);
      const errorDetail = err?.responseText || err?.jqXHR?.responseText || 'Cordys returned an error.';
      console.log('Full Error Response Body:', errorDetail);
      this.showToastMessage(`Failed to register HR member: ${errorDetail}`, 'error');
    } finally {
      this.isSaving = false;
    }
  }

  /** Save a new Interviewer via Cordys SOAP */
  private async saveInterviewer() {
    if (!this.newEntry.firstName || !this.newEntry.lastName || !this.newEntry.email || !this.newEntry.password) {
      this.showToastMessage('Please fill all required fields.', 'error');
      return;
    }

    if (this.newEntry.password !== this.newEntry.confirmPassword) {
      this.showToastMessage('Passwords do not match.', 'error');
      return;
    }

    this.isSaving = true;

    const firstName = this.newEntry.firstName;
    const lastName = this.newEntry.lastName;
    const email = this.newEntry.email;
    const password = this.newEntry.password;
    const departmentId = ''; // Removed from form
    const expertise = ''; // Removed from form

    const cordysUsername = email.split('@')[0];

    console.log('[UserManagement] Registering Interviewer in Cordys:', {
      userName: cordysUsername,
      role: 'Interviewer_RMST1'
    });

    try {
      await this.soapService.createUserInOrganization({
        userName: cordysUsername,
        description: `${firstName} ${lastName}`,
        password: password,
        role: 'Interviewer_RMST1'
      });

      console.log('[UserManagement] Registering Interviewer in DB...', { firstName, lastName, email, role: UserRole.INTERVIEWER });

      // For Interviewer, we might also want to assign a department if found
      const intDept = this.dbDepartments.find(d =>
        (d['department_name'] || '').toLowerCase().includes('engineering') ||
        (d['department_name'] || '').toLowerCase().includes('it') ||
        (d['department_name'] || '').toLowerCase().includes('technical')
      );
      const targetDeptId = intDept ? intDept['department_id'] : '';

      const dbResult = await this.soapService.insertUser({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password_hash: password,
        role: UserRole.INTERVIEWER,
        status: UserStatus.ACTIVE,
        department_id: targetDeptId,
        created_by: 'admin'
      });
      console.log('[UserManagement] Interviewer DB Result:', dbResult);

      // Update local UI list
      this.interviewers.unshift({
        id: dbResult?.user_id || dbResult?.User_id || ('INT-' + Math.floor(Math.random() * 900 + 100)),
        name: firstName + ' ' + lastName,
        email: email,
        department: 'N/A',
        status: UserStatus.ACTIVE
      });

      this.closeModal();
      this.showToastMessage(`Interviewer "${firstName} ${lastName}" registered successfully!`);

    } catch (err: any) {
      console.error('Failed to register interviewer:', err);
      const errorDetail = err?.responseText || err?.jqXHR?.responseText || 'Cordys returned an error.';
      console.log('Full Error Response Body:', errorDetail);
      this.showToastMessage(`Failed to register interviewer: ${errorDetail}`, 'error');
    } finally {
      this.isSaving = false;
    }
  }

  /** Save a new department via Cordys SOAP request (UpdateMt_departments) */
  private saveDepartment() {
    if (!this.newEntry.name) return;

    this.isSaving = true;

    // Capture values before closeModal() clears newEntry
    const deptName = this.newEntry.name;
    const managerId = this.newEntry.managerId || '';

    this.soapService.insertDepartment({
      department_name: deptName,
      manager_id: managerId,
      created_by: 'admin'
    })
      .then(() => {
        // Find manager name for local update
        const headManager = this.managers.find(m => m.id === managerId);
        // Add to local UI list so the table updates immediately
        this.departments.unshift({
          id: 'DEPT-' + String(this.departments.length + 1).padStart(2, '0'),
          name: deptName,
          head: headManager ? headManager.name : (managerId || 'TBD'),
          employees: 0,
          status: UserStatus.ACTIVE
        });
        this.closeModal();
        this.showToastMessage(`Department "${deptName}" added successfully!`);
      })
      .catch((err: any) => {
        console.error('Failed to save department:', err);
        this.showToastMessage('Failed to save department. Please try again.', 'error');
      })
      .finally(() => {
        this.isSaving = false;
      });
  }

  toggleStatus(item: any) {
    const newStatus = item.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;

    // Departments don't have a dedicated status update in DB yet
    if (this.activeTab === 'departments') {
      item.status = newStatus;
      this.showToastMessage(`Status updated to ${newStatus} for ${item.name}`);
      return;
    }

    this.soapService.updateUserStatus(item, newStatus)
      .then(() => {
        item.status = newStatus;
        this.showToastMessage(`Status updated to ${newStatus} for ${item.name}`);
      })
      .catch(err => {
        console.error('Failed to update status:', err);
        this.showToastMessage('Failed to update status in database.', 'error');
      });
  }

  resetPassword(user: any) {
    this.resetPasswordUser = user;
    this.resetPasswordData = { newPassword: '', confirmPassword: '' };
    this.showResetPasswordModal = true;
  }

  closeResetPasswordModal() {
    this.showResetPasswordModal = false;
    this.resetPasswordUser = null;
    this.resetPasswordData = { newPassword: '', confirmPassword: '' };
  }

  async saveResetPassword() {
    if (!this.resetPasswordData.newPassword || !this.resetPasswordData.confirmPassword) {
      this.showToastMessage('Please fill in both password fields.', 'error');
      return;
    }

    if (this.resetPasswordData.newPassword !== this.resetPasswordData.confirmPassword) {
      this.showToastMessage('Passwords do not match.', 'error');
      return;
    }

    if (this.resetPasswordData.newPassword.length < 6) {
      this.showToastMessage('Password must be at least 6 characters.', 'error');
      return;
    }

    this.isResettingPassword = true;
    const user = this.resetPasswordUser;
    const newPassword = this.resetPasswordData.newPassword;

    try {
      // Step 1: Update password in the database (ts_users.password_hash)
      const rawData = user._raw || {};
      await this.soapService.updateUser(rawData, {
        first_name: rawData.first_name || rawData.First_name || user.firstName,
        last_name: rawData.last_name || rawData.Last_name || user.lastName,
        email: rawData.email || rawData.Email || user.email,
        password_hash: newPassword,
        role: rawData.role || rawData.Role,
        status: rawData.status || rawData.Status || user.status,
        department_id: rawData.department_id || rawData.Department_id || '',
        updated_by: 'admin'
      });

      // Step 2: Update Cordys org password (best-effort, non-blocking)
      try {
        const cordysUsername = (user.email || '').split('@')[0];
        if (cordysUsername) {
          await this.soapService.setCordysUserPassword(cordysUsername, newPassword);
        }
      } catch (cordysErr) {
        console.warn('[UserMgmt] Cordys password update failed (non-blocking):', cordysErr);
      }

      this.closeResetPasswordModal();
      this.showToastMessage(`Password for "${user.name}" has been reset successfully!`);
    } catch (err: any) {
      console.error('[UserMgmt] Failed to reset password:', err);
      const errorDetail = err?.responseText || err?.jqXHR?.responseText || 'An error occurred.';
      this.showToastMessage(`Failed to reset password: ${errorDetail}`, 'error');
    } finally {
      this.isResettingPassword = false;
    }
  }

  resetAllPasswords() {
    if (confirm('Are you sure you want to reset passwords for ALL users in this category?')) {
      this.showToastMessage(`Bulk password reset initiated for all ${this.activeTab}`);
    }
  }

  get tabCounts() {
    return {
      managers: this.managers.length,
      hr: this.hrMembers.length,
      departments: this.departments.length,
      interviewers: this.interviewers.length
    };
  }
}
