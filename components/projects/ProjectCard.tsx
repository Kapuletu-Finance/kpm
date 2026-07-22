import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Calendar, ArrowRight, MoreHorizontal, Pencil, Rocket, PauseCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectCardProps {
  project: any;
  canManage?: boolean;
  onEdit?: (project: any) => void;
  onPublish?: (project: any) => void;
  onHold?: (project: any) => void;
}

export function ProjectCard({ project, canManage, onEdit, onPublish, onHold }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-success/10 text-success border-success/20';
      case 'Draft': return 'bg-muted text-muted-foreground border-muted-foreground/20';
      case 'Planning': return 'bg-primary/10 text-primary border-primary/20';
      case 'Completed': return 'bg-success text-success-foreground';
      case 'On Hold': return 'bg-accent/10 text-accent border-accent/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-destructive';
      case 'High': return 'text-accent';
      case 'Medium': return 'text-primary';
      case 'Low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  // Which status transitions are available for this project
  const canPublish = canManage && (project.status === 'Draft' || project.status === 'Planning');
  const canPutOnHold = canManage && project.status === 'Active';
  const canReactivate = canManage && project.status === 'On Hold';

  return (
    <Card className="flex flex-col hover:border-primary/50 transition-colors group">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-4 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <FolderKanban className="w-5 h-5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="sr-only">Project actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onEdit?.(project)} className="gap-2 cursor-pointer">
                    <Pencil className="w-4 h-4" />
                    Edit Project
                  </DropdownMenuItem>

                  {(canPublish || canPutOnHold || canReactivate) && (
                    <DropdownMenuSeparator />
                  )}

                  {canPublish && (
                    <DropdownMenuItem
                      onClick={() => onPublish?.(project)}
                      className="gap-2 cursor-pointer text-success focus:text-success"
                    >
                      <Rocket className="w-4 h-4" />
                      Publish Project
                    </DropdownMenuItem>
                  )}

                  {canPutOnHold && (
                    <DropdownMenuItem
                      onClick={() => onHold?.(project)}
                      className="gap-2 cursor-pointer text-accent focus:text-accent"
                    >
                      <PauseCircle className="w-4 h-4" />
                      Put on Hold
                    </DropdownMenuItem>
                  )}

                  {canReactivate && (
                    <DropdownMenuItem
                      onClick={() => onPublish?.(project)}
                      className="gap-2 cursor-pointer text-success focus:text-success"
                    >
                      <Rocket className="w-4 h-4" />
                      Reactivate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[40px]">
          {project.description || 'No description provided.'}
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 pb-4">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Priority</span>
            <span className={`font-medium ${getPriorityColor(project.priority)}`}>
              {project.priority}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Timeline</span>
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {project.start_date ? new Date(project.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'TBD'}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-border/50">
        <Link 
          href={`/workspace/projects/${project.id}`}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-between group/btn hover:bg-primary hover:text-primary-foreground"
          )}
        >
          View Dashboard
          <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </CardFooter>
    </Card>
  );
}
