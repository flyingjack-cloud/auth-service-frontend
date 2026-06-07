import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClientManagementService, OAuthClient } from '@shared';

@Component({
  selector: 'admin-client-list',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.scss',
})
export class ClientListComponent implements OnInit {
  private readonly clientService = inject(ClientManagementService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly clients = signal<OAuthClient[]>([]);

  ngOnInit(): void {
    this.clientService.getClients().subscribe({
      next: clients => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToNew(): void {
    this.router.navigate(['/clients/new']);
  }

  goToClient(clientId: string): void {
    this.router.navigate(['/clients', clientId]);
  }
}
