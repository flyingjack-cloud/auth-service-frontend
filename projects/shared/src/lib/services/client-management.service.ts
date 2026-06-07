import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OAuthClient, CreateClientRequest, UpdateClientRequest } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientManagementService {
  private readonly http = inject(HttpClient);

  getClients() {
    return this.http.get<OAuthClient[]>('/clients/');
  }

  getClient(clientId: string) {
    return this.http.get<OAuthClient>(`/clients/${clientId}`);
  }

  createClient(payload: CreateClientRequest) {
    return this.http.post<OAuthClient>('/clients/', payload);
  }

  updateClient(clientId: string, payload: UpdateClientRequest) {
    return this.http.put<OAuthClient>(`/clients/${clientId}`, payload);
  }

  deleteClient(clientId: string) {
    return this.http.delete<void>(`/clients/${clientId}`);
  }
}
