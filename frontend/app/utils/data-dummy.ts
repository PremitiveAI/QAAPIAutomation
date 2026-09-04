// app/utils/data-dummy.ts

export interface Employee {
  id: string;
  name: string;
  createdAt: string;
  documents: {
    pan: boolean;
    aadhaar: boolean;
    address: boolean;
    resume: boolean;
    qualification: boolean;
  };
  status: "Pending" | "Approved" | "Rejected";
}

export const EMPLOYEES: Employee[] = [
  { id:"EMP001", name:"Akshata Vijay Sawant", createdAt:"12/20/2025", documents:{ pan:true, aadhaar:true, address:false, resume:true, qualification:false }, status:"Pending" },
  { id:"EMP002", name:"Amit Kulkarni", createdAt:"12/20/2025", documents:{ pan:true, aadhaar:false, address:true, resume:true, qualification:true }, status:"Pending" },
  { id:"EMP003", name:"Priya Sharma", createdAt:"12/21/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:true }, status:"Pending" },
  { id:"EMP004", name:"Rahul Patil", createdAt:"12/21/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP005", name:"Sneha Joshi", createdAt:"12/21/2025", documents:{ pan:false, aadhaar:true, address:false, resume:false, qualification:false }, status:"Pending" },
  { id:"EMP006", name:"Kunal Deshmukh", createdAt:"12/22/2025", documents:{ pan:true, aadhaar:true, address:false, resume:true, qualification:true }, status:"Pending" },
  { id:"EMP007", name:"Neha More", createdAt:"12/22/2025", documents:{ pan:true, aadhaar:false, address:false, resume:true, qualification:false }, status:"Rejected" },
  { id:"EMP008", name:"Rohit Chavan", createdAt:"12/22/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:false }, status:"Pending" },
  { id:"EMP009", name:"Pooja Nair", createdAt:"12/22/2025", documents:{ pan:false, aadhaar:true, address:true, resume:true, qualification:true }, status:"Pending" },
  { id:"EMP010", name:"Suresh Iyer", createdAt:"12/23/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:false }, status:"Approved" },

  { id:"EMP011", name:"Anjali Verma", createdAt:"12/23/2025", documents:{ pan:true, aadhaar:false, address:true, resume:false, qualification:true }, status:"Pending" },
  { id:"EMP012", name:"Vikas Mehta", createdAt:"12/23/2025", documents:{ pan:true, aadhaar:true, address:false, resume:false, qualification:false }, status:"Pending" },
  { id:"EMP013", name:"Komal Thakur", createdAt:"12/23/2025", documents:{ pan:false, aadhaar:false, address:true, resume:true, qualification:true }, status:"Rejected" },
  { id:"EMP014", name:"Nikhil Bhosale", createdAt:"12/24/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:true }, status:"Pending" },
  { id:"EMP015", name:"Shubham Pawar", createdAt:"12/24/2025", documents:{ pan:true, aadhaar:true, address:false, resume:true, qualification:true }, status:"Approved" },

  { id:"EMP016", name:"Riya Malhotra", createdAt:"12/24/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP017", name:"Aditya Rao", createdAt:"12/24/2025", documents:{ pan:true, aadhaar:false, address:true, resume:true, qualification:false }, status:"Pending" },
  { id:"EMP018", name:"Kavita Jadhav", createdAt:"12/25/2025", documents:{ pan:false, aadhaar:true, address:false, resume:false, qualification:false }, status:"Rejected" },
  { id:"EMP019", name:"Manish Gupta", createdAt:"12/25/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP020", name:"Deepa Kulkarni", createdAt:"12/25/2025", documents:{ pan:true, aadhaar:true, address:false, resume:false, qualification:true }, status:"Pending" },

  { id:"EMP021", name:"Sanjay Mishra", createdAt:"12/26/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:false }, status:"Pending" },
  { id:"EMP022", name:"Meera Pillai", createdAt:"12/26/2025", documents:{ pan:false, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP023", name:"Arjun Singh", createdAt:"12/26/2025", documents:{ pan:true, aadhaar:false, address:false, resume:true, qualification:true }, status:"Pending" },
  { id:"EMP024", name:"Swati Desai", createdAt:"12/27/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:false }, status:"Approved" },
  { id:"EMP025", name:"Prakash Nair", createdAt:"12/27/2025", documents:{ pan:true, aadhaar:true, address:false, resume:false, qualification:false }, status:"Rejected" },

  { id:"EMP026", name:"Ayesha Khan", createdAt:"12/27/2025", documents:{ pan:false, aadhaar:true, address:true, resume:true, qualification:true }, status:"Pending" },
  { id:"EMP027", name:"Rohini Salvi", createdAt:"12/28/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:true }, status:"Approved" },
  { id:"EMP028", name:"Sameer Shaikh", createdAt:"12/28/2025", documents:{ pan:true, aadhaar:false, address:false, resume:true, qualification:false }, status:"Pending" },
  { id:"EMP029", name:"Tanvi Kulkarni", createdAt:"12/28/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP030", name:"Yogesh Patil", createdAt:"12/29/2025", documents:{ pan:false, aadhaar:true, address:false, resume:false, qualification:false }, status:"Rejected" },

  { id:"EMP031", name:"Nikita Shinde", createdAt:"12/29/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:true }, status:"Pending" },
  { id:"EMP032", name:"Harsh Vardhan", createdAt:"12/29/2025", documents:{ pan:true, aadhaar:false, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP033", name:"Pankaj Yadav", createdAt:"12/30/2025", documents:{ pan:true, aadhaar:true, address:false, resume:true, qualification:false }, status:"Pending" },
  { id:"EMP034", name:"Rashmi Gokhale", createdAt:"12/30/2025", documents:{ pan:false, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP035", name:"Omkar Kulkarni", createdAt:"12/30/2025", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:false }, status:"Pending" },

  { id:"EMP036", name:"Snehal Patwardhan", createdAt:"12/31/2025", documents:{ pan:true, aadhaar:true, address:false, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP037", name:"Ritesh Choudhary", createdAt:"12/31/2025", documents:{ pan:true, aadhaar:false, address:false, resume:false, qualification:false }, status:"Rejected" },
  { id:"EMP038", name:"Pallavi Kulkarni", createdAt:"12/31/2025", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP039", name:"Abhishek Tiwari", createdAt:"01/01/2026", documents:{ pan:true, aadhaar:true, address:false, resume:false, qualification:true }, status:"Pending" },
  { id:"EMP040", name:"Kiran Jagtap", createdAt:"01/01/2026", documents:{ pan:false, aadhaar:true, address:true, resume:true, qualification:false }, status:"Pending" },

  { id:"EMP041", name:"Sonal Bendre", createdAt:"01/01/2026", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP042", name:"Akhil Menon", createdAt:"01/02/2026", documents:{ pan:true, aadhaar:false, address:true, resume:false, qualification:false }, status:"Pending" },
  { id:"EMP043", name:"Bhavna Shah", createdAt:"01/02/2026", documents:{ pan:false, aadhaar:true, address:false, resume:true, qualification:true }, status:"Rejected" },
  { id:"EMP044", name:"Rajeev Malhotra", createdAt:"01/02/2026", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP045", name:"Smita Kulkarni", createdAt:"01/03/2026", documents:{ pan:true, aadhaar:true, address:false, resume:false, qualification:true }, status:"Pending" },

  { id:"EMP046", name:"Naveen Shetty", createdAt:"01/03/2026", documents:{ pan:true, aadhaar:false, address:true, resume:true, qualification:false }, status:"Pending" },
  { id:"EMP047", name:"Isha Kapoor", createdAt:"01/03/2026", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
  { id:"EMP048", name:"Ravindra Pawar", createdAt:"01/04/2026", documents:{ pan:false, aadhaar:true, address:false, resume:false, qualification:false }, status:"Rejected" },
  { id:"EMP049", name:"Madhuri Dixit", createdAt:"01/04/2026", documents:{ pan:true, aadhaar:true, address:true, resume:false, qualification:true }, status:"Approved" },
  { id:"EMP050", name:"Sachin Kulkarni", createdAt:"01/04/2026", documents:{ pan:true, aadhaar:true, address:true, resume:true, qualification:true }, status:"Approved" },
];
