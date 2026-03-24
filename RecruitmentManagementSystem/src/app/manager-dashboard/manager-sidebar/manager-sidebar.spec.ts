import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerSidebar } from './manager-sidebar';

describe('ManagerSidebar', () => {
  let component: ManagerSidebar;
  let fixture: ComponentFixture<ManagerSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSidebar],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerSidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
