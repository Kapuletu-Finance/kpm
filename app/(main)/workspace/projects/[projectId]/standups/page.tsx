'use client';

import { use, useState, useMemo } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useStandups, useSubmitStandup, useUpdateStandup } from '@/hooks/useStandups';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Send, AlertCircle, HelpCircle, User, MessageSquareReply } from 'lucide-react';

export default function StandupsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { memberProfile } = useAuth();
  
  const { data: standups, isLoading } = useStandups(projectId);
  const { data: teamMembers } = useProjectTeam(projectId);
  
  const submitMutation = useSubmitStandup(projectId);
  const updateMutation = useUpdateStandup(projectId);

  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [risks, setRisks] = useState('');
  const [helpNeeded, setHelpNeeded] = useState('');

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canReply = isAdmin || isPM;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Check if current user already submitted today
  const hasSubmittedToday = useMemo(() => {
    if (!standups || !memberProfile) return false;
    return standups.some(s => 
      s.member_id === memberProfile.id && 
      format(new Date(s.submitted_at), 'yyyy-MM-dd') === todayStr
    );
  }, [standups, memberProfile, todayStr]);

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="h-64 bg-muted rounded-xl w-full"></div>
      <div className="space-y-4">
        <div className="h-40 bg-muted rounded-xl w-full"></div>
        <div className="h-40 bg-muted rounded-xl w-full"></div>
      </div>
    </div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yesterday.trim() || !today.trim()) {
      toast.error('Yesterday and Today are required.');
      return;
    }
    
    try {
      await submitMutation.mutateAsync({
        yesterday, today, blockers, risks, help_needed: helpNeeded
      });
      toast.success('Standup submitted successfully!');
      // Reset form
      setYesterday(''); setToday(''); setBlockers(''); setRisks(''); setHelpNeeded('');
    } catch (error) {
      toast.error('Failed to submit standup');
    }
  };

  const handleReplySubmit = async (standupId: string) => {
    if (!replyText.trim()) return;
    try {
      await updateMutation.mutateAsync({ standupId, data: { manager_comments: replyText } });
      toast.success('Reply posted!');
      setReplyingTo(null);
      setReplyText('');
    } catch (error) {
      toast.error('Failed to post reply');
    }
  };

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in h-full pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Standups</h1>
        <p className="text-muted-foreground mt-1">Asynchronous team coordination. Submit your daily update and review the team's progress.</p>
      </div>

      {/* Submission Section */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <h2 className="font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Your Update for Today ({format(new Date(), 'MMM d, yyyy')})
          </h2>
        </div>

        {hasSubmittedToday ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mb-4">
              <CheckCircle2Icon className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-lg font-medium">You're all caught up!</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              You have already submitted your standup for today. Check out what the rest of the team is working on below.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">What did you accomplish yesterday? <span className="text-destructive">*</span></label>
                <Textarea 
                  placeholder="Supports markdown..." 
                  value={yesterday} 
                  onChange={(e) => setYesterday(e.target.value)} 
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">What are your goals for today? <span className="text-destructive">*</span></label>
                <Textarea 
                  placeholder="Supports markdown..." 
                  value={today} 
                  onChange={(e) => setToday(e.target.value)} 
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Blockers (Optional)
                </label>
                <Textarea 
                  placeholder="Anything blocking your progress?" 
                  value={blockers} 
                  onChange={(e) => setBlockers(e.target.value)} 
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-orange-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Risks (Optional)
                </label>
                <Textarea 
                  placeholder="Any potential risks?" 
                  value={risks} 
                  onChange={(e) => setRisks(e.target.value)} 
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-blue-500 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" /> Help Needed (Optional)
                </label>
                <Textarea 
                  placeholder="Need help from someone?" 
                  value={helpNeeded} 
                  onChange={(e) => setHelpNeeded(e.target.value)} 
                  className="min-h-[80px]"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitMutation.isPending} className="w-full md:w-auto">
                {submitMutation.isPending ? 'Submitting...' : <><Send className="w-4 h-4 mr-2" /> Submit Standup</>}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Team Feed */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Team Feed</h2>
        
        {(!standups || standups.length === 0) && (
          <div className="text-center p-8 bg-card border rounded-xl shadow-sm text-muted-foreground">
            No standups submitted yet.
          </div>
        )}

        <div className="space-y-6">
          {standups?.map((standup) => {
            const isToday = format(new Date(standup.submitted_at), 'yyyy-MM-dd') === todayStr;
            const hasBlockers = !!standup.blockers;
            
            return (
              <div key={standup.id} className={`bg-card border rounded-xl shadow-sm overflow-hidden ${hasBlockers ? 'border-destructive/30' : ''}`}>
                <div className="p-4 border-b bg-muted/10 flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border">
                      <AvatarImage src={standup.members?.avatar_url || ''} />
                      <AvatarFallback>{standup.members?.first_name?.[0]}{standup.members?.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {standup.members?.first_name} {standup.members?.last_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(standup.submitted_at), 'MMM d, yyyy - h:mm a')}
                        {isToday && <Badge variant="secondary" className="ml-2 text-[10px]">Today</Badge>}
                      </p>
                    </div>
                  </div>
                  {standup.sprints?.name && (
                    <Badge variant="outline" className="text-xs bg-primary/5">{standup.sprints.name}</Badge>
                  )}
                </div>
                
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Yesterday</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 bg-secondary/20 p-3 rounded-lg">
                      <MarkdownRenderer content={standup.yesterday} />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Today</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 bg-secondary/20 p-3 rounded-lg">
                      <MarkdownRenderer content={standup.today} />
                    </div>
                  </div>
                </div>

                {(standup.blockers || standup.risks || standup.help_needed) && (
                  <div className="p-5 border-t bg-destructive/5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {standup.blockers && (
                      <div>
                        <h4 className="text-xs font-bold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Blockers
                        </h4>
                        <div className="text-sm text-foreground/80"><MarkdownRenderer content={standup.blockers} /></div>
                      </div>
                    )}
                    {standup.risks && (
                      <div>
                        <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Risks
                        </h4>
                        <div className="text-sm text-foreground/80"><MarkdownRenderer content={standup.risks} /></div>
                      </div>
                    )}
                    {standup.help_needed && (
                      <div>
                        <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> Help Needed
                        </h4>
                        <div className="text-sm text-foreground/80"><MarkdownRenderer content={standup.help_needed} /></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Manager Comments Section */}
                {standup.manager_comments ? (
                  <div className="p-4 border-t bg-primary/5 flex items-start gap-3">
                    <MessageSquareReply className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Manager Feedback</h4>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                        <MarkdownRenderer content={standup.manager_comments} />
                      </div>
                    </div>
                  </div>
                ) : (
                  canReply && !replyingTo && (
                    <div className="p-3 border-t bg-muted/10 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setReplyingTo(standup.id)} className="text-muted-foreground hover:text-primary">
                        <MessageSquareReply className="w-4 h-4 mr-2" /> Reply
                      </Button>
                    </div>
                  )
                )}

                {replyingTo === standup.id && (
                  <div className="p-4 border-t bg-muted/20 animate-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-primary uppercase tracking-wider mb-2 block">Leave Feedback (Markdown supported)</label>
                    <Textarea 
                      autoFocus
                      placeholder="Address blockers or provide feedback..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="min-h-[80px] bg-background mb-3"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</Button>
                      <Button size="sm" onClick={() => handleReplySubmit(standup.id)} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Posting...' : 'Post Reply'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CheckCircle2Icon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
