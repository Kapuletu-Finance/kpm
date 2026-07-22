'use client';

import { use } from 'react';
import { useDocuments, useDeleteDocument } from '@/hooks/useDocuments';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { UploadDocumentDialog } from '@/components/projects/UploadDocumentDialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FolderOpen, FileText, Download, Trash2, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function DocumentsHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { memberProfile } = useAuth();
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: documents, isLoading } = useDocuments(projectId);
  const deleteMutation = useDeleteDocument(projectId);

  const role = teamMembers?.find((m: any) => m.member_id === memberProfile?.id)?.project_role;
  const isGlobalAdmin = memberProfile?.organization_role === 'Organization Admin';
  const canManage = isGlobalAdmin || role === 'Project Manager';

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document');
    }
  };

  if (isLoading) {
    return <div className="p-6 animate-pulse">Loading Knowledge Base...</div>;
  }

  // Group by category
  const categories = documents?.reduce((acc: any, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {}) || {};

  const sortedCategories = Object.keys(categories).sort();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Knowledge Base</h1>
          <p className="text-muted-foreground max-w-2xl">
            A centralized repository for project requirements, architecture diagrams, research, and contracts.
          </p>
        </div>
        {canManage && <UploadDocumentDialog projectId={projectId} />}
      </div>

      {documents?.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <FolderOpen className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Documents Yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            The knowledge base is empty. Upload your first architecture diagram, requirement sheet, or meeting minutes.
          </p>
          {canManage && <UploadDocumentDialog projectId={projectId} />}
        </div>
      ) : (
        <div className="space-y-12">
          {sortedCategories.map(category => (
            <section key={category} className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">{category}</h2>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full ml-2">
                  {categories[category].length}
                </span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categories[category].map((doc: any) => (
                  <div key={doc.id} className="bg-card border rounded-xl p-4 flex flex-col group hover:shadow-md transition-all hover:border-primary/50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={doc.cloudinary_url} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                        {(canManage || doc.uploaded_by === memberProfile?.id) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(doc.id, doc.title)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold line-clamp-1 mb-1" title={doc.title}>{doc.title}</h3>
                    
                    <div className="mt-auto pt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        {doc.members && (
                          <>
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={doc.members.avatar_url || ''} />
                              <AvatarFallback>{doc.members.first_name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[80px]">{doc.members.first_name}</span>
                          </>
                        )}
                      </div>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
