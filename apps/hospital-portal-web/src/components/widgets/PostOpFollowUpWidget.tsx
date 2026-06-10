/**
 * Post-Op Follow-Up Widget
 * Tracks post-operative recovery milestones, symptoms, and follow-up schedule
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, AlertTriangle, Camera, CalendarCheck } from 'lucide-react';
import { WidgetProps } from '@/lib/widgets/widget-types';
import type { PostOpFollowUpData } from '@/lib/api/widgets.api';
import { widgetsApi } from '@/lib/api/widgets.api';
import { usePostopChecklist } from '@/hooks/use-clinical-masters';

const PostOpFollowUpWidget: React.FC<WidgetProps> = ({
  patientId,
  size,
}) => {
  const [followUpData, setFollowUpData] = useState<PostOpFollowUpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For this demo, using a mock surgery ID. In production, this would come from props or context
  const surgeryId = 'SURG001';

  useEffect(() => {
    if (patientId) {
      loadFollowUpData();
    }
  }, [patientId]);

  const loadFollowUpData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await widgetsApi.getPostOpFollowUp(surgeryId);
      setFollowUpData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load post-op data');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    try {
      await widgetsApi.updatePostOpMilestone(surgeryId, milestoneId, { completed: true });
      loadFollowUpData(); // Reload data
    } catch (err) {
      alert('Failed to update milestone');
    }
  };

  const getSeverityColor = (painLevel: number) => {
    if (painLevel === 0) return 'text-green-600';
    if (painLevel <= 2) return 'text-yellow-600';
    if (painLevel <= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMilestoneIcon = (milestone: any) => {
    if (milestone.completed) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (milestone.day <= (followUpData?.currentDay || 0)) return <Clock className="w-5 h-5 text-blue-500" />;
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !followUpData) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        <AlertTriangle className="w-5 h-5 mr-2" />
        {error || 'No post-op data available'}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{followUpData.surgeryType}</h3>
          <p className="text-sm text-gray-500">
            Day {followUpData.currentDay} Post-Op • {new Date(followUpData.surgeryDate).toLocaleDateString()}
          </p>
        </div>
        <Calendar className="w-6 h-6 text-blue-600" />
      </div>

      {/* Post-op checklist (master-driven) */}
      {postopChecklistItems.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-gray-900">Post-op Checklist</h4>
          <ul className="space-y-2">
            {postopChecklistItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkedItems[item] ?? false}
                  onChange={(e) =>
                    setCheckedItems((prev) => ({ ...prev, [item]: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className={checkedItems[item] ? 'text-gray-500 line-through' : 'text-gray-800'}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Milestones Timeline */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-gray-900 mb-3">Recovery Milestones</h4>
        <div className="space-y-4">
          {followUpData.milestones.map((milestone, index) => (
            <div key={milestone.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getMilestoneIcon(milestone)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${milestone.completed ? 'text-green-600' : 'text-gray-900'}`}>
                    Day {milestone.day} - {milestone.title}
                  </p>
                  {!milestone.completed && milestone.day <= followUpData.currentDay && (
                    <button
                      onClick={() => handleCompleteMilestone(milestone.id)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{milestone.description}</p>
                {milestone.completed && milestone.completedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Completed on {new Date(milestone.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Symptoms */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Current Symptoms</h4>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700">Pain Level</span>
              <span className={`text-sm font-medium ${getSeverityColor(followUpData.symptoms.painLevel)}`}>
                {followUpData.symptoms.painLevel}/6
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  followUpData.symptoms.painLevel === 0
                    ? 'bg-green-500'
                    : followUpData.symptoms.painLevel <= 2
                    ? 'bg-yellow-500'
                    : followUpData.symptoms.painLevel <= 4
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${(followUpData.symptoms.painLevel / 6) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Vision Clarity</span>
            <span className={`text-sm font-medium ${
              followUpData.symptoms.visionClarity === 'Good' ? 'text-green-600' :
              followUpData.symptoms.visionClarity === 'Fair' ? 'text-yellow-600' :
              'text-orange-600'
            }`}>
              {followUpData.symptoms.visionClarity}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Discharge</span>
            <span className={`text-sm font-medium ${
              followUpData.symptoms.discharge === 'None' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {followUpData.symptoms.discharge}
            </span>
          </div>

          {followUpData.symptoms.complications && followUpData.symptoms.complications.length > 0 && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs font-medium text-red-800">Complications Reported:</p>
              <ul className="text-xs text-red-700 mt-1 list-disc list-inside">
                {followUpData.symptoms.complications.map((comp, idx) => (
                  <li key={idx}>{comp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Photos */}
      {followUpData.photos.length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Camera className="w-4 h-4 mr-2" />
            Progress Photos ({followUpData.photos.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {followUpData.photos.map((photo) => (
              <div key={photo.id} className="border rounded overflow-hidden">
                <img
                  src={photo.url}
                  alt="Post-op progress"
                  className="w-full h-24 object-cover"
                />
                <p className="text-xs text-gray-500 p-2">
                  {new Date(photo.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Follow-Up */}
      {followUpData.nextFollowUpDate && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex items-start space-x-3">
          <CalendarCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Next Follow-Up</p>
            <p className="text-sm text-blue-700">
              {new Date(followUpData.nextFollowUpDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2 pt-2">
        <button className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center">
          <Camera className="w-4 h-4 mr-2" />
          Upload Photo
        </button>
        <button className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          Report Issue
        </button>
      </div>
    </div>
  );
};

export default PostOpFollowUpWidget;
