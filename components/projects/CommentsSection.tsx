import { useState } from 'react';
import { useComments, useSubmitComment, useDeleteComment, Comment } from '@/hooks/useComments';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Trash2, Reply, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface CommentsSectionProps {
  projectId: string;
  entityType: 'Feature' | 'Deliverable' | 'Meeting' | 'Project' | 'Module';
  entityId: string;
  canManage: boolean;
}

export function CommentsSection({ projectId, entityType, entityId, canManage }: CommentsSectionProps) {
  const { memberProfile } = useAuth();
  const { data: comments, isLoading } = useComments(projectId, entityType, entityId);
  const submitMutation = useSubmitComment(projectId, entityType, entityId);
  const deleteMutation = useDeleteComment(projectId, entityType, entityId);

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await submitMutation.mutateAsync({ comment: newComment });
      setNewComment('');
      toast.success('Comment posted');
    } catch (err) {
      toast.error('Failed to post comment');
    }
  };

  const handleReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      await submitMutation.mutateAsync({ comment: replyText, parent_comment_id: parentId });
      setReplyText('');
      setReplyingTo(null);
      toast.success('Reply posted');
    } catch (err) {
      toast.error('Failed to post reply');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteMutation.mutateAsync(commentId);
      toast.success('Comment deleted');
    } catch (err) {
      toast.error('Failed to delete comment');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl"></div>;
  }

  // Organize into threads (1 level deep)
  const topLevelComments = comments?.filter(c => !c.parent_comment_id) || [];
  const getReplies = (parentId: string) => comments?.filter(c => c.parent_comment_id === parentId) || [];

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Discussion</h3>
        <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full ml-2">
          {comments?.length || 0}
        </span>
      </div>

      <div className="space-y-6">
        {topLevelComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the conversation!</p>
        ) : (
          topLevelComments.map(comment => (
            <div key={comment.id} className="space-y-4">
              <CommentCard 
                comment={comment} 
                canDelete={canManage || memberProfile?.id === comment.member_id}
                onDelete={() => handleDelete(comment.id)}
                onReplyClick={() => { setReplyingTo(comment.id); setReplyText(''); }}
              />

              {/* Replies */}
              <div className="pl-8 md:pl-12 space-y-4 border-l-2 border-muted ml-4 md:ml-6 mt-2">
                {getReplies(comment.id).map(reply => (
                  <CommentCard 
                    key={reply.id} 
                    comment={reply} 
                    canDelete={canManage || memberProfile?.id === reply.member_id}
                    onDelete={() => handleDelete(reply.id)}
                  />
                ))}

                {/* Reply Input */}
                {replyingTo === comment.id && (
                  <form onSubmit={(e) => handleReply(e, comment.id)} className="flex items-start gap-3 mt-4">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={memberProfile?.avatar_url || ''} />
                      <AvatarFallback>{memberProfile?.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea 
                        placeholder="Write a reply..." 
                        value={replyText} 
                        onChange={e => setReplyText(e.target.value)}
                        className="min-h-[80px] text-sm"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>Cancel</Button>
                        <Button type="submit" size="sm" disabled={submitMutation.isPending || !replyText.trim()}>
                          {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Reply'}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t pt-6 mt-6">
        <form onSubmit={handlePost} className="flex items-start gap-4">
          <Avatar className="w-10 h-10 shrink-0 hidden md:block">
            <AvatarImage src={memberProfile?.avatar_url || ''} />
            <AvatarFallback>{memberProfile?.first_name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea 
              placeholder="Start a new discussion..." 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitMutation.isPending || !newComment.trim()}>
                {submitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting...</> : 'Post Comment'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function CommentCard({ comment, canDelete, onDelete, onReplyClick }: { 
  comment: Comment, 
  canDelete: boolean, 
  onDelete: () => void,
  onReplyClick?: () => void 
}) {
  return (
    <div className="flex items-start gap-3 group">
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        <AvatarImage src={comment.members?.avatar_url || ''} />
        <AvatarFallback>{comment.members?.first_name?.[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm">{comment.members?.first_name} {comment.members?.last_name}</span>
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
        </div>
        <div className="text-sm text-foreground/90 whitespace-pre-wrap mb-2">
          {comment.comment}
        </div>
        <div className="flex items-center gap-4">
          {onReplyClick && (
            <button onClick={onReplyClick} className="text-xs font-medium flex items-center text-muted-foreground hover:text-foreground transition-colors">
              <Reply className="w-3 h-3 mr-1" /> Reply
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="text-xs font-medium flex items-center text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
