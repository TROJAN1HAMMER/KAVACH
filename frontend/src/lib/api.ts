import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const api = {
  // Upload a repository ZIP file to start a scan
  uploadRepo: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await apiClient.post("/scan", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Get the current status of a scan
  getScanStatus: async (scanId: string) => {
    const response = await apiClient.get(`/scan/${scanId}`);
    return response.data;
  },

  // Get all findings for a scan
  getFindings: async (scanId: string) => {
    const response = await apiClient.get(`/findings/${scanId}`);
    return response.data;
  },

  // Check which reports are available
  getReportStatus: async (scanId: string) => {
    const response = await apiClient.get(`/reports/${scanId}`);
    return response.data;
  },
  
  // URL generators for report downloads
  getReportDownloadUrl: (scanId: string, type: 'pdf' | 'sarif' | 'sbom') => {
    return `${API_BASE_URL}/reports/${scanId}/download/${type}`;
  }
};
