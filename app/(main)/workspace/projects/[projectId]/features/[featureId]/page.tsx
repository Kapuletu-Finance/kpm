'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { 
  useFeature, 
  useUpdateFeature, 
  useDeleteFeature, 
  useCreateChecklist, 
  useUpdateChecklist, 
  useDeleteChecklist,
  useAssignMember,
  useRemoveMember
} from '@/hooks/useFeatures';
import { useRoadmap } from '@/hooks/useRoadmap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, Circle, Edit2, Plus, Save, Trash2, UserPlus, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function FeatureDetailsPage({ params }: { params: Promise<{ projectId: string, featureId: string }> }) {
  const { projectId, featureId } = use(params);
  const router = useRouter();
  const { memberProfile } = useAuth();
  
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: roadmaps } = useRoadmap(projectId);
  const { data: feature, isLoading } = useFeature(projectId, featureId);
  
  const updateFeatureMutation = useUpdateFeature(projectId);
  const deleteFeatureMutation = useDeleteFeature(projectId);
  
  const createChecklistMutation = useCreateChecklist(projectId, featureId);
  const updateChecklistMutation = useUpdateChecklist(projectId, featureId);
  const deleteChecklistMutation = useDeleteChecklist(projectId, featureId);

  const assignMemberMutation = useAssignMember(projectId, featureId);
  const removeMemberMutation = useRemoveMember(projectId, featureId);

  // Edit States
  const [editingSection, setEditingSection] = useState<'requirements' | 'acceptance_criteria' | 'technical_notes' | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Checklist State
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/3"></div>
      <div className="flex gap-6"><div className="h-96 bg-muted rounded-xl flex-1"></div><div className="w-80 bg-muted rounded-xl h-64"></div></div>
    </div>;
  }

  if (!feature) {
    return <div>Feature not found</div>;
  }

  // Hierarchy
  const currentPhase = roadmaps?.find(r => r.modules.some(m => m.id === feature.module_id));
  const currentModule = currentPhase?.modules.find(m => m.id === feature.module_id);

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canManage = isAdmin || isPM;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-blue-500 text-white';
      case 'Low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  // --- Handlers ---
  const handleSaveContent = async () => {
    if (!editingSection) return;
    try {
      await updateFeatureMutation.mutateAsync({
        featureId,
        data: { [editingSection]: editContent }
      });
      toast.success('Section updated');
      setEditingSection(null);
    } catch (e: any) {
      toast.error('Failed to update section');
    }
  };

  const handleUpdateStatus = async (status: any) => {
    try {
      await updateFeatureMutation.mutateAsync({ featureId, data: { status } });
      toast.success('Status updated');
    } catch (e) { toast.error('Update failed'); }
  };

  const handleUpdatePriority = async (priority: any) => {
    try {
      await updateFeatureMutation.mutateAsync({ featureId, data: { priority } });
      toast.success('Priority updated');
    } catch (e) { toast.error('Update failed'); }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistTitle.trim()) return;
    try {
      await createChecklistMutation.mutateAsync({
        title: newChecklistTitle,
        order_index: feature.feature_checklists?.length || 0
      });
      setNewChecklistTitle('');
    } catch (e) { toast.error('Failed to create item'); }
  };

  const handleToggleChecklist = async (item: any) => {
    try {
      await updateChecklistMutation.mutateAsync({
        checklistId: item.id,
        data: { is_completed: !item.is_completed }
      });
    } catch (e) { toast.error('Failed to update item'); }
  };

  const handleDeleteFeature = async () => {
    if (confirm('Are you sure you want to delete this Feature?')) {
      try {
        await deleteFeatureMutation.mutateAsync({ featureId, moduleId: feature.module_id });
        toast.success('Feature deleted');
        router.push(`/workspace/projects/${projectId}/modules/${feature.module_id}`);
      } catch (e) { toast.error('Failed to delete feature'); }
    }
  };

  const handleAssignMember = async (memberId: string) => {
    try {
      await assignMemberMutation.mutateAsync({ member_id: memberId });
      toast.success('Member assigned');
    } catch (e: any) { toast.error(e.message || 'Assignment failed'); }
  };

  const handleRemoveMember = async (featureMemberId: string) => {
    try {
      await removeMemberMutation.mutateAsync(featureMemberId);
      toast.success('Member removed');
    } catch (e: any) { toast.error('Removal failed'); }
  };

  // Unassigned project members for dropdown
  const assignedIds = new Set(feature.feature_members?.map(fm => fm.member_id) || []);
  const availableMembers = teamMembers?.filter((m: any) => !assignedIds.has(m.member_id));

  return (
    <div className="flex flex-col h-full animate-in fade-in space-y-6">
      
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-muted-foreground gap-2 overflow-x-auto whitespace-nowrap">
        <Link href={`/workspace/projects/${projectId}/roadmap`} className="hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Roadmap
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span>{currentPhase?.name || '...'}</span>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/workspace/projects/${projectId}/modules/${feature.module_id}`} className="hover:text-foreground transition-colors">
          {currentModule?.name || '...'}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium truncate max-wxs">{feature.title}</span>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{feature.title}</h1>
          {feature.description && <p className="text-muted-foreground">{feature.description}</p>}
        </div>
        {canManage && (
          <Button variant="destructive" size="sm" onClick={handleDeleteFeature}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Markdown Sections */}
          {(['requirements', 'acceptance_criteria', 'technical_notes'] as const).map(section => (
            <div key={section} className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold capitalize">
                  {section.replace('_', ' ')}
                </h3>
                {editingSection !== section ? (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditContent(feature[section] || '');
                    setEditingSection(section);
                  }}>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingSection(null)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveContent}>
                      <Save className="w-4 h-4 mr-2" /> Save
                    </Button>
                  </div>
                )}
              </div>
              
              {editingSection === section ? (
                <Textarea 
                  className="min-h-[200px] font-mono text-sm bg-muted/30" 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={`Write your ${section.replace('_', ' ')} using Markdown...`}
                />
              ) : (
                <div className="bg-muted/10 rounded-lg p-4 border min-h-[100px]">
                  <MarkdownRenderer content={feature[section] || ''} />
                </div>
              )}
            </div>
          ))}

          {/* Checklist */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Checklist</h3>
            
            <div className="space-y-2 mb-4">
              {feature.feature_checklists?.map(item => (
                <div key={item.id} className={`flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-muted/50 ${item.is_completed ? 'opacity-60' : ''}`}>
                  <button onClick={() => handleToggleChecklist(item)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors">
                    {item.is_completed ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${item.is_completed ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                      {item.title}
                    </p>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteChecklistMutation.mutate(item.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {feature.feature_checklists?.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No checklist items yet.</p>
              )}
            </div>

            <form onSubmit={handleCreateChecklist} className="flex gap-2">
              <Input 
                placeholder="Add a new checklist item..." 
                value={newChecklistTitle}
                onChange={e => setNewChecklistTitle(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!newChecklistTitle.trim()}>
                Add
              </Button>
            </form>
          </div>
          
        </div>

        {/* Right Column - Meta */}
        <div className="space-y-6">
          
          {/* Status & Priority Card */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4 uppercase tracking-wider">Details</h3>
            
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <Select value={feature.status} onValueChange={handleUpdateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Priority</label>
              <Select value={feature.priority} onValueChange={handleUpdatePriority}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(feature.priority).split(' ')[0]}`} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {['Low', 'Medium', 'High', 'Critical'].map(p => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(p).split(' ')[0]}`} />
                        {p}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Start Date</label>
                <Input 
                  type="date" 
                  className="text-sm h-9" 
                  value={feature.start_date || ''}
                  onChange={e => updateFeatureMutation.mutate({ featureId, data: { start_date: e.target.value }})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Due Date</label>
                <Input 
                  type="date" 
                  className="text-sm h-9" 
                  value={feature.due_date || ''}
                  onChange={e => updateFeatureMutation.mutate({ featureId, data: { due_date: e.target.value }})}
                />
              </div>
            </div>
          </div>

          {/* Assignees Card */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Assignees</h3>
              <Badge variant="secondary">{feature.feature_members?.length || 0}</Badge>
            </div>
            
            <div className="space-y-3 mb-4">
              {feature.feature_members?.map(fm => (
                <div key={fm.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {fm.members.first_name[0]}{fm.members.last_name[0]}
                    </div>
                    <div className="text-sm font-medium">
                      {fm.members.first_name} {fm.members.last_name}
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(fm.member_id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {feature.feature_members?.length === 0 && (
                <p className="text-sm text-muted-foreground">No one assigned yet.</p>
              )}
            </div>

            {canManage && availableMembers && availableMembers.length > 0 && (
              <Select onValueChange={(val) => { if(val) handleAssignMember(val) }} value="">
                <SelectTrigger className="w-full">
                  <div className="flex items-center text-muted-foreground">
                    <UserPlus className="w-4 h-4 mr-2" /> Assign Member...
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m: any) => (
                    <SelectItem key={m.member_id} value={m.member_id}>
                      {m.members.first_name} {m.members.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
        </div>
      </div>
      
    </div>
  );
}
