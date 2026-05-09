import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
      <h1 style="font-size:4rem;margin:0">403</h1>
      <h2>Access Denied</h2>
      <p>You don't have permission to view this page.</p>
      <a routerLink="/schedule" style="margin-top:1rem">Go to Schedule</a>
    </div>
  `,
})
export class ForbiddenComponent {}
