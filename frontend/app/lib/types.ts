export type DocumentType =
| "PAN"
| "AADHAAR"
| "ADDRESS_PROOF"
| "RESUME"
| "QUALIFICATION";


export interface Employee {
id: string;
name: string;
documents: Record<DocumentType, boolean>;
}