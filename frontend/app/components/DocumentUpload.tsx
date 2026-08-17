const documents = [
"PAN Card",
"Aadhaar Card",
"Address Proof",
"Resume",
"Highest Qualification",
];


export default function DocumentUpload() {
return (
<div className="space-y-4">
{documents.map((doc) => (
<div key={doc} className="flex justify-between items-center bg-white/5 p-4 rounded-lg">
<span>{doc}</span>
<input type="file" multiple />
</div>
))}
</div>
);
}