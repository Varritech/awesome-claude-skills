/**
 * GCP authentication shared by every Google Cloud client in this app.
 *
 * Vercel can't read service-account JSON files from disk, so the JSON is
 * stored base64-encoded in the env var `GCP_SERVICE_ACCOUNT_JSON_B64`. We
 * decode once and pass the credentials object directly into the
 * google-auth-library JWT/Auth client.
 *
 * The project id is read from `GCP_PROJECT_ID` and overrides whatever
 * appears on the credentials object so swapping service accounts between
 * projects stays a single env change.
 */

import { GoogleAuth } from 'google-auth-library';

let _auth: GoogleAuth | null = null;
let _projectId: string | null = null;

function loadCredentials(): {
  client_email: string;
  private_key: string;
  project_id: string;
} {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON_B64;
  if (!raw) {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON_B64 is not set');
  }
  let json: { client_email?: string; private_key?: string; project_id?: string };
  try {
    json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (err) {
    throw new Error(`GCP_SERVICE_ACCOUNT_JSON_B64 is not valid base64-JSON: ${(err as Error).message}`);
  }
  if (!json.client_email || !json.private_key) {
    throw new Error('GCP service account JSON missing client_email or private_key');
  }
  return {
    client_email: json.client_email,
    private_key: json.private_key,
    project_id: process.env.GCP_PROJECT_ID ?? json.project_id ?? '',
  };
}

export function getProjectId(): string {
  if (_projectId) return _projectId;
  const envProject = process.env.GCP_PROJECT_ID;
  if (envProject) {
    _projectId = envProject;
    return envProject;
  }
  _projectId = loadCredentials().project_id;
  return _projectId;
}

export function isConfigured(): boolean {
  return Boolean(process.env.GCP_SERVICE_ACCOUNT_JSON_B64 && process.env.GCP_PROJECT_ID);
}

export function getAuth(): GoogleAuth {
  if (_auth) return _auth;
  const creds = loadCredentials();
  _auth = new GoogleAuth({
    credentials: { client_email: creds.client_email, private_key: creds.private_key },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  return _auth;
}
