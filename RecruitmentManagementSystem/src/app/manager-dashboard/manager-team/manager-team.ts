import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-manager-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-team.html',
  styleUrls: ['./manager-team.scss'],
})
export class ManagerTeam {
  showAddModal = false;

  newMember = {
    name: '',
    email: '',
    role: '',
    department: ''
  };

  teamMembers = [
    { name: 'Sarah Jenkins', role: 'Senior Frontend Dev', email: 's.jenkins@company.com', status: 'Online' },
    { name: 'Michael Chen', role: 'Backend Engineer', email: 'm.chen@company.com', status: 'In Meeting' },
    { name: 'Amanda Ross', role: 'Product Manager', email: 'a.ross@company.com', status: 'Offline' }
  ];

  openAddModal() {
    this.showAddModal = true;
  }

  closeModal() {
    this.showAddModal = false;
    this.newMember = { name: '', email: '', role: '', department: '' };
  }

  saveMember() {
    if (this.newMember.name && this.newMember.email && this.newMember.role) {
      this.teamMembers.unshift({
        name: this.newMember.name,
        email: this.newMember.email,
        role: this.newMember.role,
        status: 'Online'
      });
      this.closeModal();
    }
  }
}
