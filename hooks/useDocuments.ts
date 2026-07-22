import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Document {
  id: string;
  project_id: string;
  title: string;
  category: 'Requirements' | 'Architecture' | 'Research' | 'Meeting Minutes' | 'Contracts' | 'Other';
  cloudinary_url: string;
  version: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'documents'],
    queryFn: async (): Promise<Document[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/documents`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/v1/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to upload document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'documents'] });
    },
  });
}

export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'documents'] });
    },
  });
}
