import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { 
  fetchAppointments, 
  createAppointment, 
  updateAppointment, 
  cancelAppointment,
  AppointmentParams,
  AppointmentResponse,
  ApiException 
} from '@/lib/api/appointments';

export function useAppointments(params: AppointmentParams = {}) {
  const queryClient = useQueryClient();
  
  const {
    data,
    isLoading,
    error,
    isRefetching,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['appointments', params],
    queryFn: () => fetchAppointments(params),
    retry: (failureCount, error) => {
      if (error instanceof ApiException) {
        // Don't retry client errors (4xx)
        return error.error.status >= 500 && failureCount < 3;
      }
      return failureCount < 3;
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const createMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment created successfully');
    },
    onError: (error: ApiException) => {
      toast.error(error.error.detail || 'Failed to create appointment');
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment updated successfully');
    },
    onError: (error: ApiException) => {
      toast.error(error.error.detail || 'Failed to update appointment');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment cancelled successfully');
    },
    onError: (error: ApiException) => {
      toast.error(error.error.detail || 'Failed to cancel appointment');
    },
  });

  return {
    appointments: data,
    isLoading,
    error,
    isRefetching,
    refetch,
    isFetching,
    totalPages: data ? Math.ceil(data.totalCount / (params.pageSize || 10)) : 0,
    createAppointment: createMutation.mutateAsync,
    updateAppointment: updateMutation.mutateAsync,
    cancelAppointment: cancelMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}