import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoapService } from '../../services/soap.service';

interface UserItem {
  user_id: string;
  name: string;
  email: string;
  is_delegate: boolean;
}

@Component({
  selector: 'app-manager-delegates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-delegates.html',
  styleUrls: ['./manager-delegates.scss']
})
export class ManagerDelegates implements OnInit {
  isLoading = false;
  isSaving = false;
  loggedInUserId = '';

  users: UserItem[] = [];
  searchQuery = '';

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToastFlag = false;
  private toastTimeout: any;

  constructor(private soap: SoapService) {}

  ngOnInit(): void {
    this.loggedInUserId = sessionStorage.getItem('loggedInUserId') || '';
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      const [allUsers, delegateIds] = await Promise.all([
        this.soap.getUsers(),
        this.soap.getDelegates(this.loggedInUserId)
      ]);

      const delegateSet = new Set(delegateIds);

      this.users = allUsers
        .filter((u: any) => {
          const id = u['user_id'] || u['User_id'] || '';
          return id && id !== this.loggedInUserId;
        })
        .map((u: any) => ({
          user_id: u['user_id'] || u['User_id'] || '',
          name: ((u['first_name'] || u['First_name'] || '') + ' ' + (u['last_name'] || u['Last_name'] || '')).trim(),
          email: u['email'] || u['Email'] || '',
          is_delegate: delegateSet.has(u['user_id'] || u['User_id'] || '')
        }));
    } catch (err) {
      console.error('Failed to load delegates:', err);
      this.showToast('Failed to load users', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  get filteredUsers(): UserItem[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.users;
    return this.users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }

  get activeDelegates(): UserItem[] {
    return this.users.filter(u => u.is_delegate);
  }

  toggleDelegate(user: UserItem): void {
    user.is_delegate = !user.is_delegate;
  }

  removeDelegate(user: UserItem): void {
    user.is_delegate = false;
  }

  async saveDelegates(): Promise<void> {
    this.isSaving = true;
    try {
      const delegateIds = this.users.filter(u => u.is_delegate).map(u => u.user_id);
      await this.soap.updateDelegates(this.loggedInUserId, delegateIds);
      this.showToast('Delegates saved successfully!', 'success');
    } catch (err) {
      console.error('Failed to save delegates:', err);
      this.showToast('Failed to save delegates', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.showToastFlag = false, 4000);
  }
}
