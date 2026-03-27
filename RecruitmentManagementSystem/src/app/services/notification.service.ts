import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private socket: Socket;
  private notificationSubject = new Subject<{ type: string; data: any }>();

  constructor(private http: HttpClient) {
    // Initialize socket connection using the proxy
    // this.socket = io('http://localhost:3000', {
    //   transports: ['websocket', 'polling'], // ensure broad compatibility
    // });
    this.socket = io();
    // Handle generic errors
    this.socket.on('connect_error', (err) => {
      console.warn('[NotificationService] Socket.io connect_error:', err.message);
    });

    // Listen for events emitted by the Node.js server
    this.socket.on('userLogin', (data) => {
      this.notificationSubject.next({ type: 'LOGIN', data });
    });

    this.socket.on('userLogout', (data) => {
      this.notificationSubject.next({ type: 'LOGOUT', data });
    });

    this.socket.on('candidateApplied', (data) => {
      this.notificationSubject.next({ type: 'CANDIDATE_APPLIED', data });
    });
  }

  /**
   * Hits the Node.js middleware to broadcast an event.
   * @param type Event type ('LOGIN', 'LOGOUT', 'CANDIDATE_APPLIED')
   * @param data Payload to broadcast
   */
  sendNotification(type: 'LOGIN' | 'LOGOUT' | 'CANDIDATE_APPLIED', data: any) {
    console.log(`[NotificationService] Sending ${type} notification via middleware...`);
    this.http.post('/notify', { type, data }).subscribe({
      next: (resp) => console.log(`[NotificationService] ${type} notification broadcasted.`),
      error: (err) => console.error(`[NotificationService] Failed to broadcast ${type}:`, err),
    });
  }

  /**
   * Observable to subscribe to incoming real-time notifications.
   */
  get notifications$(): Observable<{ type: string; data: any }> {
    return this.notificationSubject.asObservable();
  }
}
