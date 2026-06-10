/**
 * Curated provider presets for the "Add remote" wizard. Field keys match
 * rclone config parameters exactly (https://rclone.org/docs/).
 */

export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
}

export interface ProviderPreset {
  /** rclone backend type, e.g. "s3" */
  type: string;
  label: string;
  description: string;
  fields: ProviderField[];
  /**
   * OAuth backends: created without nonInteractive so rclone opens the
   * system browser to complete authorization.
   */
  oauth?: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    type: "s3",
    label: "S3 (Amazon & compatible)",
    description: "Amazon S3, Cloudflare R2, MinIO, Wasabi and other S3-compatible storage.",
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        required: true,
        options: ["AWS", "Cloudflare", "DigitalOcean", "Minio", "Wasabi", "Ceph", "Other"],
      },
      { key: "access_key_id", label: "Access key ID", type: "text", required: true },
      { key: "secret_access_key", label: "Secret access key", type: "password", required: true },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1" },
      {
        key: "endpoint",
        label: "Endpoint",
        type: "text",
        placeholder: "https://… (only for non-AWS providers)",
      },
    ],
  },
  {
    type: "b2",
    label: "Backblaze B2",
    description: "Backblaze B2 cloud storage.",
    fields: [
      { key: "account", label: "Account ID or application key ID", type: "text", required: true },
      { key: "key", label: "Application key", type: "password", required: true },
    ],
  },
  {
    type: "drive",
    label: "Google Drive",
    description: "Your browser will open to authorize access when the remote is created.",
    oauth: true,
    fields: [
      {
        key: "client_id",
        label: "Client ID (optional)",
        type: "text",
        help: "Using your own OAuth client avoids rclone's shared rate limits.",
      },
      { key: "client_secret", label: "Client secret (optional)", type: "password" },
      {
        key: "scope",
        label: "Scope",
        type: "select",
        options: ["drive", "drive.readonly", "drive.file"],
      },
    ],
  },
  {
    type: "dropbox",
    label: "Dropbox",
    description: "Your browser will open to authorize access when the remote is created.",
    oauth: true,
    fields: [],
  },
  {
    type: "onedrive",
    label: "OneDrive",
    description: "Your browser will open to authorize access when the remote is created.",
    oauth: true,
    fields: [],
  },
  {
    type: "sftp",
    label: "SFTP",
    description: "Any server reachable over SSH.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "example.com" },
      { key: "user", label: "Username", type: "text", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "22" },
      {
        key: "pass",
        label: "Password",
        type: "password",
        help: "Leave empty when using a key file.",
      },
      { key: "key_file", label: "SSH key file", type: "text", placeholder: "~/.ssh/id_ed25519" },
    ],
  },
  {
    type: "webdav",
    label: "WebDAV",
    description: "WebDAV servers, including Nextcloud and ownCloud.",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        required: true,
        placeholder: "https://example.com/remote.php/webdav/",
      },
      {
        key: "vendor",
        label: "Vendor",
        type: "select",
        options: ["nextcloud", "owncloud", "sharepoint", "other"],
      },
      { key: "user", label: "Username", type: "text" },
      { key: "pass", label: "Password", type: "password" },
    ],
  },
  {
    type: "local",
    label: "Local disk",
    description: "Another view of this computer's filesystem.",
    fields: [],
  },
  {
    type: "crypt",
    label: "Crypt (encrypted overlay)",
    description: "Encrypts another remote. Create the underlying remote first.",
    fields: [
      {
        key: "remote",
        label: "Underlying remote path",
        type: "text",
        required: true,
        placeholder: "gdrive:encrypted",
      },
      { key: "password", label: "Password", type: "password", required: true },
      {
        key: "password2",
        label: "Salt password (optional)",
        type: "password",
        help: "Recommended; must be remembered to read your data.",
      },
      {
        key: "filename_encryption",
        label: "Filename encryption",
        type: "select",
        options: ["standard", "obfuscate", "off"],
      },
    ],
  },
];

export function presetFor(type: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.type === type);
}
