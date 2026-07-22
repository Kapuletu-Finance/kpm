'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSprint } from '@/hooks/useSprints';
import { useUpdateFeature } from '@/hooks/useFeatures';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const COLUMNS = [
  'Idea', 
  'Requirements', 
  'Design', 
  'Development', 
  'Integration', 
  'Testing', 
  'Approval', 
  'Released'
] as const;

type ColumnType = typeof COLUMNS[number];

export default function SprintBoardPage({ params }: { params: Promise<{ projectId: string, sprintId: string }> }) {
  const { projectId, sprintId } = use(params);
  const router = useRouter();
  
  const { data: sprint, isLoading } = useSprint(projectId, sprintId);
  const updateFeatureMutation = useUpdateFeature(projectId);

  // Local state for optimistic UI updates during drag
  const [boardData, setBoardData] = useState<Record<ColumnType, any[]>>({
    Idea: [], Requirements: [], Design: [], Development: [],
    Integration: [], Testing: [], Approval: [], Released: []
  });

  // Sync server data to local state
  useEffect(() => {
    if (sprint?.features) {
      const newBoard: Record<ColumnType, any[]> = {
        Idea: [], Requirements: [], Design: [], Development: [],
        Integration: [], Testing: [], Approval: [], Released: []
      };
      
      sprint.features.forEach((feature: any) => {
        if (newBoard[feature.status as ColumnType]) {
          newBoard[feature.status as ColumnType].push(feature);
        }
      });
      
      setBoardData(newBoard);
    }
  }, [sprint]);

  if (isLoading) {
    return <div className="animate-pulse h-full flex flex-col space-y-6">
      <div className="h-8 bg-muted rounded w-1/3"></div>
      <div className="flex-1 flex gap-4 overflow-hidden">
        {[1,2,3,4].map(i => <div key={i} className="min-w-[300px] h-full bg-muted rounded-xl"></div>)}
      </div>
    </div>;
  }

  if (!sprint) {
    return <div>Sprint not found</div>;
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a valid column
    if (!destination) return;
    
    // Dropped in exactly the same place
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceCol = source.droppableId as ColumnType;
    const destCol = destination.droppableId as ColumnType;

    // Optimistic UI update
    const sourceItems = [...boardData[sourceCol]];
    const destItems = sourceCol === destCol ? sourceItems : [...boardData[destCol]];

    const [movedItem] = sourceItems.splice(source.index, 1);
    
    if (sourceCol === destCol) {
      // Reordering within the same column (we don't persist order index yet, just UI update)
      sourceItems.splice(destination.index, 0, movedItem);
      setBoardData(prev => ({
        ...prev,
        [sourceCol]: sourceItems
      }));
    } else {
      // Moving to a new column (Status change)
      movedItem.status = destCol;
      destItems.splice(destination.index, 0, movedItem);
      setBoardData(prev => ({
        ...prev,
        [sourceCol]: sourceItems,
        [destCol]: destItems
      }));

      // Persist to database
      try {
        await updateFeatureMutation.mutateAsync({ 
          featureId: draggableId, 
          data: { status: destCol } 
        });
        toast.success(`Moved to ${destCol}`);
      } catch (error) {
        toast.error('Failed to update status');
        // Revert could be handled here by refetching, but for now we let React Query invalidate and catch up.
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-blue-500 text-white';
      case 'Low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center text-sm text-muted-foreground gap-2 mb-1">
            <Link href={`/workspace/projects/${projectId}/sprints`} className="hover:text-foreground flex items-center transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Sprints
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">{sprint.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{sprint.name} Board</h1>
            {sprint.status === 'Active' && <Badge className="bg-success text-success-foreground">Active Sprint</Badge>}
            {sprint.status === 'Planning' && <Badge variant="outline">Planning Phase</Badge>}
          </div>
        </div>
        
        {(sprint.status === 'Planning' || sprint.status === 'Active') && (
          <Button variant="outline" onClick={() => router.push(`/workspace/projects/${projectId}/sprints/${sprintId}/plan`)}>
            Sprint Scope & Backlog
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full items-start">
            
            {COLUMNS.map((columnId) => (
              <div key={columnId} className="flex flex-col min-w-[320px] w-[320px] max-h-full bg-secondary/30 rounded-xl border">
                {/* Column Header */}
                <div className="p-3 border-b bg-secondary/50 rounded-t-xl flex justify-between items-center shrink-0">
                  <h3 className="font-semibold text-sm text-foreground">{columnId}</h3>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {boardData[columnId]?.length || 0}
                  </Badge>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={columnId}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                    >
                      {boardData[columnId]?.map((feature: any, index: number) => (
                        <Draggable key={feature.id} draggableId={feature.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ ...provided.draggableProps.style }}
                              className={`
                                bg-card border rounded-lg p-4 shadow-sm group
                                ${snapshot.isDragging ? 'shadow-lg border-primary ring-2 ring-primary/20 scale-105 z-50' : 'hover:border-primary/50'}
                                transition-all
                              `}
                              onClick={() => router.push(`/workspace/projects/${projectId}/features/${feature.id}`)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <Badge className={`text-[10px] ${getPriorityColor(feature.priority)}`}>{feature.priority}</Badge>
                              </div>
                              
                              <h4 className="font-medium text-sm text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
                                {feature.title}
                              </h4>
                              
                              {feature.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                  {feature.description}
                                </p>
                              )}

                              {/* Assignees */}
                              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                {feature.feature_members && feature.feature_members.length > 0 ? (
                                  <div className="flex -space-x-2">
                                    {feature.feature_members.slice(0, 3).map((fm: any) => (
                                      <div key={fm.id} className="w-6 h-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[8px] font-bold text-primary">
                                        {fm.members.first_name[0]}{fm.members.last_name[0]}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Unassigned</span>
                                )}
                                
                                {columnId === 'Released' && <CheckCircle2 className="w-4 h-4 text-success" />}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
            
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
