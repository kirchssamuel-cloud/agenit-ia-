export interface Client {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  industry?: string;
  notes?: string;
  createdAt: string;
}

export interface ClientModule {
  clientId: string;
  moduleId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  enabledAt: string;
}
