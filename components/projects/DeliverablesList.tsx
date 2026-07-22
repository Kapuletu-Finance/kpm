'use client';

import { useState, useRef } from 'react';
import { useDeliverables, useSubmitDeliverable, useDeleteDeliverable } from '@/hooks/useDeliverables';
import { useReviews, useSubmitReview } from '@/hooks/useReviews';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Plus, GitPullRequest, PenTool, FileText, Image as ImageIcon, Video, Link2, Trash2, Code2, UploadCloud, Loader2, MonitorPlay, MessageSquareReply, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

const DELIVERABLE_TYPES = ['GitHub PR', 'Figma Link', 'API Doc', 'Document', 'Video', 'Screenshot', 'Demo', 'Commit', 'Deployment URL'] as const;
const MEDIA_TYPES = ['Video', 'Screenshot', 'Document', 'Demo'];

export function DeliverablesList({ projectId, featureId, canManage }: { projectId: string, featureId: string, canManage: boolean }) {
  const { memberProfile } = useAuth();
  const { data: deliverables, isLoading } = useDeliverables(projectId, featureId);
  const submitMutation = useSubmitDeliverable(projectId, featureId);
  const deleteMutation = useDeleteDeliverable(projectId, featureId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<typeof DELIVERABLE_TYPES[number]>('GitHub PR');
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title is required');

    let finalUrl = link;
    const isMedia = MEDIA_TYPES.includes(type);

    if (isMedia) {
      if (!file) return toast.error('Please select a file to upload');
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch('/api/v1/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Upload failed');
        }
        
        const uploadData = await uploadRes.json();
        finalUrl = uploadData.url;
      } catch (error: any) {
        setIsUploading(false);
        return toast.error(error.message);
      }
    } else {
      if (!link.trim()) return toast.error('Link is required');
      try {
        new URL(link);
      } catch {
        return toast.error('Please enter a valid URL');
      }
    }

    try {
      await submitMutation.mutateAsync({
        title, type, link: finalUrl, description
      });
      toast.success('Deliverable submitted successfully');
      setDialogOpen(false);
      setTitle(''); setLink(''); setDescription(''); setFile(null);
    } catch (error) {
      toast.error('Failed to submit deliverable');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (deliverableId: string) => {
    if (confirm('Are you sure you want to delete this deliverable?')) {
      try {
        await deleteMutation.mutateAsync(deliverableId);
        toast.success('Deleted');
      } catch (error) { toast.error('Failed to delete'); }
    }
  };

  const isMediaSelected = MEDIA_TYPES.includes(type);

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Deliverables</h3>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Deliverable</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Deliverable</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input placeholder="e.g., Auth API Implementation PR" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              {isMediaSelected ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload File</label>
                  <div 
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">{file ? file.name : 'Click to select a file'}</span>
                    <span className="text-xs text-muted-foreground mt-1">Upload securely to Cloudinary</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <Input type="url" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea placeholder="Any notes for the reviewer?" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitMutation.isPending || isUploading}>
                  {(submitMutation.isPending || isUploading) ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : 'Submit'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-24 bg-muted rounded-xl"></div>
      ) : deliverables?.length === 0 ? (
        <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">No deliverables submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliverables?.map(deliverable => (
            <DeliverableCard 
              key={deliverable.id}
              deliverable={deliverable}
              projectId={projectId}
              featureId={featureId}
              canManage={canManage}
              memberProfile={memberProfile}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliverableCard({ deliverable, projectId, featureId, canManage, memberProfile, onDelete }: any) {
  const { data: reviews } = useReviews(projectId, featureId, deliverable.id);
  const submitReview = useSubmitReview(projectId, featureId, deliverable.id);
  
  const [reviewOpen, setReviewOpen] = useState(false);
  const [decision, setDecision] = useState<'Approved' | 'Changes Requested' | 'Rejected'>('Approved');
  const [comments, setComments] = useState('');

  const getIcon = (type: string) => {
    switch (type) {
      case 'GitHub PR': case 'Commit': return <GitPullRequest className="w-5 h-5" />;
      case 'Figma Link': return <PenTool className="w-5 h-5" />;
      case 'API Doc': case 'Document': return <FileText className="w-5 h-5" />;
      case 'Screenshot': return <ImageIcon className="w-5 h-5" />;
      case 'Video': case 'Demo': return <Video className="w-5 h-5" />;
      case 'Deployment URL': return <MonitorPlay className="w-5 h-5" />;
      default: return <Link2 className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-success text-success-foreground';
      case 'Rejected': return 'bg-destructive text-destructive-foreground';
      case 'Reviewed': case 'Changes Requested': return 'bg-orange-500 text-white';
      case 'Submitted': return 'bg-blue-500 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitReview.mutateAsync({ decision, comments });
      toast.success('Review submitted successfully');
      setReviewOpen(false);
      setComments('');
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  const latestReview = reviews?.[0];

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-4 hover:border-primary/50 transition-colors bg-card">
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0 hidden md:block">
          {getIcon(deliverable.type)}
        </div>
        <div className="flex-1 min-w-0 space-y-1 w-full">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium truncate flex items-center gap-2">
              <span className="md:hidden text-primary">{getIcon(deliverable.type)}</span>
              {deliverable.title}
            </h4>
            <Badge className={`shrink-0 ${getStatusColor(deliverable.status)} text-[10px]`}>{deliverable.status}</Badge>
          </div>
          
          <p className="text-xs text-muted-foreground mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-background">{deliverable.type}</Badge>
            • Submitted by {deliverable.members?.first_name} on {format(new Date(deliverable.created_at), 'MMM d, yyyy')}
          </p>
          
          {deliverable.description && (
            <p className="text-sm text-foreground/80 bg-muted/30 p-2 rounded-md">{deliverable.description}</p>
          )}
          
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => window.open(deliverable.link, '_blank', 'noopener,noreferrer')}>
              View Deliverable
            </Button>
            
            {(canManage || memberProfile?.id === deliverable.member_id) && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(deliverable.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}

            {canManage && (
              <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogTrigger render={<Button size="sm" variant="outline" className="ml-auto"><MessageSquareReply className="w-4 h-4 mr-2" /> Review</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Review Deliverable</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleReviewSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Decision</label>
                      <Select value={decision} onValueChange={(v: any) => setDecision(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Approved"><span className="flex items-center gap-2 text-success"><CheckCircle2 className="w-4 h-4"/> Approved</span></SelectItem>
                          <SelectItem value="Changes Requested"><span className="flex items-center gap-2 text-orange-500"><HelpCircle className="w-4 h-4"/> Request Changes</span></SelectItem>
                          <SelectItem value="Rejected"><span className="flex items-center gap-2 text-destructive"><XCircle className="w-4 h-4"/> Rejected</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Feedback / Comments (Optional)</label>
                      <Textarea placeholder="Explain your decision..." value={comments} onChange={e => setComments(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setReviewOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={submitReview.isPending}>
                        {submitReview.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Review'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Latest Review Display */}
      {latestReview && (
        <div className={`mt-2 p-3 rounded-lg border flex gap-3 items-start ${
          latestReview.decision === 'Approved' ? 'bg-success/5 border-success/20' :
          latestReview.decision === 'Rejected' ? 'bg-destructive/5 border-destructive/20' :
          'bg-orange-500/5 border-orange-500/20'
        }`}>
          <Avatar className="w-8 h-8 mt-0.5">
            <AvatarImage src={latestReview.members?.avatar_url || ''} />
            <AvatarFallback>{latestReview.members?.first_name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{latestReview.members?.first_name} {latestReview.members?.last_name}</span>
              <Badge variant="outline" className={`text-[10px] ${
                latestReview.decision === 'Approved' ? 'text-success border-success/50' :
                latestReview.decision === 'Rejected' ? 'text-destructive border-destructive/50' :
                'text-orange-500 border-orange-500/50'
              }`}>{latestReview.decision}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">{format(new Date(latestReview.reviewed_at), 'MMM d, h:mm a')}</span>
            </div>
            {latestReview.comments && (
              <p className="text-sm mt-1 text-foreground/90">{latestReview.comments}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
