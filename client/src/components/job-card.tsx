import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import JobApplicationModal from "@/components/modals/job-application-modal";
import JobEditModal from "@/components/modals/job-edit-modal";
import {
  Clock,
  Users,
  MapPin,
  Bookmark,
  Building,
  DollarSign,
  Edit,
  Trash2
} from "lucide-react";
import type { JobWithCompany } from "@/lib/types";

interface JobCardProps {
  job: JobWithCompany;
  compact?: boolean;
  showCompany?: boolean;
}

export default function JobCard({ job, compact = false, showCompany = true }: JobCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const bookmarkMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/bookmarks', { jobId: job.id }),
    onSuccess: () => {
      setIsBookmarked(!isBookmarked);
      toast({
        title: isBookmarked ? "Removed from bookmarks" : "Bookmarked",
        description: isBookmarked 
          ? "Job removed from your bookmarks" 
          : "Job added to your bookmarks"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bookmark job",
        variant: "destructive"
      });
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/jobs/${job.id}`),
    onSuccess: () => {
      toast({
        title: "Job deleted",
        description: "Job posting has been removed successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive"
      });
    }
  });

  const formatTimeAgo = (date: string | Date) => {
    const now = new Date();
    const posted = new Date(date);
    const diffTime = Math.abs(now.getTime() - posted.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  const handleEasyApply = () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to apply for jobs",
        variant: "destructive"
      });
      return;
    }
    
    if (user.userType !== 'job_seeker') {
      toast({
        title: "Access restricted",
        description: "Only job seekers can apply for jobs",
        variant: "destructive"
      });
      return;
    }

    setIsApplicationModalOpen(true);
  };

  const handleBookmark = () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to bookmark jobs",
        variant: "destructive"
      });
      return;
    }
    
    bookmarkMutation.mutate();
  };

  const skillsArray = Array.isArray(job.skills) ? job.skills : 
    (job.skills ? job.skills.split(',').map(s => s.trim()) : []);

  if (compact) {
    return (
      <Card className="job-card hover:shadow-md transition-all duration-200">
        <CardContent className="p-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm line-clamp-2">{job.title}</h3>
            {showCompany && (
              <p className="text-xs text-gray-600">{job.company?.name || 'Unknown Company'}</p>
            )}
            <div className="flex items-center text-xs text-gray-500">
              <MapPin className="h-3 w-3 mr-1" />
              <span>
                {[job.city, job.state, job.zipCode, job.country]
                  .filter(Boolean)
                  .join(', ') || job.location}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {job.jobType?.replace('_', ' ') || 'Full Time'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="job-card hover:shadow-lg transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4 flex-1">
              {showCompany && (
                <Avatar className="h-12 w-12">
                  <AvatarImage src={job.company?.logoUrl || undefined} />
                  <AvatarFallback className="bg-linkedin-blue text-white">
                    <Building className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 line-clamp-2">
                  {job.title}
                </h3>
                {showCompany && (
                  <p className="text-gray-600 font-medium">
                    {job.company?.name || 'Unknown Company'}
                  </p>
                )}
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>
                    {[job.city, job.state, job.zipCode, job.country]
                      .filter(Boolean)
                      .join(', ') || job.location}
                  </span>
                  <span className="mx-2">•</span>
                  <Badge variant="outline" className="text-xs">
                    {job.jobType.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmark}
              className="text-gray-400 hover:text-linkedin-blue"
              disabled={bookmarkMutation.isPending}
            >
              <Bookmark 
                className={`h-5 w-5 ${isBookmarked ? 'fill-current text-linkedin-blue' : ''}`} 
              />
            </Button>
          </div>

          {/* Job Details */}
          <div className="space-y-3 mb-4">
            {/* Experience Level and Salary */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {job.experienceLevel.replace('_', ' ')} level
              </span>
              {job.salary && (
                <span className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  {job.salary}
                </span>
              )}
            </div>

            {/* Skills */}
            {skillsArray.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {skillsArray.slice(0, 5).map((skill, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="skill-tag text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
                {skillsArray.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{skillsArray.length - 5} more
                  </Badge>
                )}
              </div>
            )}

            {/* Description */}
            <p className="text-gray-600 text-sm line-clamp-3">
              {job.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {formatTimeAgo(job.createdAt)}
              </span>
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {job.applicationCount || 0} applicants
              </span>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/jobs/${job.id}`)}
                className="border-linkedin-blue text-linkedin-blue hover:bg-linkedin-blue hover:text-white"
              >
                View Details
              </Button>
              
              {/* Admin Actions */}
              {(user?.email === 'krupas@vedsoft.com' || user?.userType === 'admin') && (
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                    className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this job posting?')) {
                        deleteJobMutation.mutate();
                      }
                    }}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    disabled={deleteJobMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
              
              <Button
                onClick={handleEasyApply}
                className="bg-linkedin-blue text-white hover:bg-linkedin-dark"
                size="sm"
              >
                Easy Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <JobApplicationModal
        job={job}
        isOpen={isApplicationModalOpen}
        onClose={() => setIsApplicationModalOpen(false)}
      />
      
      <JobEditModal
        job={job}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </>
  );
}
