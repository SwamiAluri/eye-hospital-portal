'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { performanceReviewApi, PerformanceReview, ReviewGoal, ReviewCompetency } from '@/lib/api/performance-review.api';
import { ArrowLeft, Save, Send, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { usePerformanceRatings } from '@/hooks/use-hr-masters';

export default function PerformanceReviewDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.id as string;

  const [review, setReview] = useState<PerformanceReview | null>(null);
  const [goals, setGoals] = useState<ReviewGoal[]>([]);
  const [competencies, setCompetencies] = useState<ReviewCompetency[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'goals' | 'competencies' | 'comments'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [strengths, setStrengths] = useState('');
  const [areasForImprovement, setAreasForImprovement] = useState('');
  const [developmentPlan, setDevelopmentPlan] = useState('');
  const [reviewerComments, setReviewerComments] = useState('');
  const [employeeComments, setEmployeeComments] = useState('');

  useEffect(() => {
    loadReview();
  }, [reviewId]);

  const loadReview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await performanceReviewApi.getById(reviewId);
      const reviewData = response.data;
      
      setReview(reviewData);
      setGoals(reviewData.goals || []);
      setCompetencies(reviewData.competencies || []);
      setStrengths(reviewData.strengths || '');
      setAreasForImprovement(reviewData.areasForImprovement || '');
      setDevelopmentPlan(reviewData.developmentPlan || '');
      setReviewerComments(reviewData.reviewerComments || '');
      setEmployeeComments(reviewData.employeeComments || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load review');
      console.error('Error loading review:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScores = async () => {
    if (!review) return;

    setSaving(true);
    try {
      await performanceReviewApi.updateScores(reviewId, {
        goals,
        competencies,
        strengths,
        areasForImprovement,
        developmentPlan,
        reviewerComments
      });
      
      setIsEditing(false);
      alert('Scores updated successfully!');
      loadReview();
    } catch (err: any) {
      alert('Failed to update scores: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!confirm('Submit this review for approval? You will not be able to edit it afterwards.')) {
      return;
    }

    try {
      await performanceReviewApi.submitForApproval(reviewId, { employeeComments });
      alert('Review submitted for approval!');
      loadReview();
    } catch (err: any) {
      alert('Failed to submit: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleApprove = async () => {
    const approverComments = prompt('Approval comments (optional):');
    if (approverComments === null) return;

    try {
      await performanceReviewApi.approve(reviewId, {
        approved: true,
        approverComments
      });
      alert('Review approved successfully!');
      loadReview();
    } catch (err: any) {
      alert('Failed to approve: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleReject = async () => {
    const approverComments = prompt('Rejection reason (required):');
    if (!approverComments) {
      alert('Rejection reason is required');
      return;
    }

    try {
      await performanceReviewApi.approve(reviewId, {
        approved: false,
        approverComments
      });
      alert('Review rejected');
      loadReview();
    } catch (err: any) {
      alert('Failed to reject: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      await performanceReviewApi.delete(reviewId);
      alert('Review deleted');
      router.push('/dashboard/admin/performance-reviews');
    } catch (err: any) {
      alert('Failed to delete: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const addGoal = () => {
    setGoals([...goals, {
      goalDescription: '',
      weight: 10,
      score: 0
    }]);
  };

  const updateGoal = (index: number, field: keyof ReviewGoal, value: any) => {
    const updated = [...goals];
    updated[index] = { ...updated[index], [field]: value };
    setGoals(updated);
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const addCompetency = () => {
    setCompetencies([...competencies, {
      competencyName: '',
      weight: 10,
      score: 0
    }]);
  };

  const updateCompetency = (index: number, field: keyof ReviewCompetency, value: any) => {
    const updated = [...competencies];
    updated[index] = { ...updated[index], [field]: value };
    setCompetencies(updated);
  };

  const removeCompetency = (index: number) => {
    setCompetencies(competencies.filter((_, i) => i !== index));
  };

  const calculateOverallScore = () => {
    const allItems = [...goals, ...competencies];
    if (allItems.length === 0) return 0;

    const totalWeight = allItems.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = allItems.reduce((sum, item) => 
      sum + ((item.score || 0) * item.weight), 0
    );

    return weightedSum / totalWeight;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'Review not found'}</p>
          <button
            onClick={() => router.push('/dashboard/admin/performance-reviews')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Reviews
          </button>
        </div>
      </div>
    );
  }

  const overallScore = calculateOverallScore();
  const canEdit = review.status === 'Draft';
  const canSubmit = review.status === 'Draft';
  const canApprove = review.status === 'Pending';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/admin/performance-reviews')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {review.reviewType} Review - {review.employeeName}
              </h1>
              <p className="text-gray-600 mt-1">
                Period: {new Date(review.reviewPeriodStart).toLocaleDateString()} - {new Date(review.reviewPeriodEnd).toLocaleDateString()}
              </p>
              <div className="flex gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  review.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                  review.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                  review.status === 'Approved' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {review.status}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Score: {overallScore.toFixed(2)} / 5.0
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit
              </button>
            )}
            {isEditing && (
              <>
                <button
                  onClick={handleSaveScores}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Save size={20} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    loadReview();
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
              </>
            )}
            {canSubmit && !isEditing && (
              <button
                onClick={handleSubmitForApproval}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                <Send size={20} />
                Submit
              </button>
            )}
            {canApprove && (
              <>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <CheckCircle size={20} />
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <XCircle size={20} />
                  Reject
                </button>
              </>
            )}
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <Trash2 size={20} />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {['details', 'goals', 'competencies', 'comments'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Review Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Employee</dt>
                      <dd className="text-base text-gray-900">{review.employeeName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Reviewer</dt>
                      <dd className="text-base text-gray-900">{review.reviewerName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Review Type</dt>
                      <dd className="text-base text-gray-900">{review.reviewType}</dd>
                    </div>
                    {review.overallScore && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Overall Score</dt>
                        <dd className="text-2xl font-bold text-gray-900">{review.overallScore.toFixed(2)} / 5.0</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="text-base text-gray-900">{new Date(review.createdAt).toLocaleString()}</dd>
                    </div>
                    {review.submittedAt && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                        <dd className="text-base text-gray-900">{new Date(review.submittedAt).toLocaleString()}</dd>
                      </div>
                    )}
                    {review.approvedAt && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Approved</dt>
                        <dd className="text-base text-gray-900">{new Date(review.approvedAt).toLocaleString()}</dd>
                      </div>
                    )}
                    {review.approvedByName && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Approved By</dt>
                        <dd className="text-base text-gray-900">{review.approvedByName}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Strengths</h3>
                {isEditing ? (
                  <textarea
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter employee strengths..."
                  />
                ) : (
                  <p className="text-gray-700">{strengths || 'Not provided'}</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Areas for Improvement</h3>
                {isEditing ? (
                  <textarea
                    value={areasForImprovement}
                    onChange={(e) => setAreasForImprovement(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter areas for improvement..."
                  />
                ) : (
                  <p className="text-gray-700">{areasForImprovement || 'Not provided'}</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Development Plan</h3>
                {isEditing ? (
                  <textarea
                    value={developmentPlan}
                    onChange={(e) => setDevelopmentPlan(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter development plan..."
                  />
                ) : (
                  <p className="text-gray-700">{developmentPlan || 'Not provided'}</p>
                )}
              </div>
            </div>
          )}

          {/* Goals Tab */}
          {activeTab === 'goals' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Goals ({goals.length})</h3>
                {isEditing && (
                  <button
                    onClick={addGoal}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add Goal
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {goals.map((goal, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Goal Description
                        </label>
                        <input
                          type="text"
                          value={goal.goalDescription}
                          onChange={(e) => updateGoal(index, 'goalDescription', e.target.value)}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (%)
                        </label>
                        <input
                          type="number"
                          value={goal.weight}
                          onChange={(e) => updateGoal(index, 'weight', Number(e.target.value))}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Score (1-5)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={goal.score || 0}
                          onChange={(e) => updateGoal(index, 'score', Number(e.target.value))}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      {isEditing && (
                        <div className="col-span-2 flex items-end">
                          <button
                            onClick={() => removeGoal(index)}
                            className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {goals.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No goals defined</p>
                )}
              </div>
            </div>
          )}

          {/* Competencies Tab */}
          {activeTab === 'competencies' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Competencies ({competencies.length})</h3>
                {isEditing && (
                  <button
                    onClick={addCompetency}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add Competency
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {competencies.map((comp, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Competency Name
                        </label>
                        <input
                          type="text"
                          value={comp.competencyName}
                          onChange={(e) => updateCompetency(index, 'competencyName', e.target.value)}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (%)
                        </label>
                        <input
                          type="number"
                          value={comp.weight}
                          onChange={(e) => updateCompetency(index, 'weight', Number(e.target.value))}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rating
                        </label>
                        <select
                          value={comp.score || 0}
                          onChange={(e) => updateCompetency(index, 'score', Number(e.target.value))}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
                        >
                          <option value={0}>Not rated</option>
                          {performanceRatings.map((r) => (
                            <option key={r.value} value={r.score}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                      {isEditing && (
                        <div className="col-span-2 flex items-end">
                          <button
                            onClick={() => removeCompetency(index)}
                            className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {competencies.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No competencies defined</p>
                )}
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Reviewer Comments</h3>
                {isEditing ? (
                  <textarea
                    value={reviewerComments}
                    onChange={(e) => setReviewerComments(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter reviewer comments..."
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{reviewerComments || 'No comments provided'}</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Employee Comments</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{employeeComments || 'No comments provided'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
