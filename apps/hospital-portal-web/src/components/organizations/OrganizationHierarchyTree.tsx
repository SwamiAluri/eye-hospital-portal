'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  TreePine,
  ChevronRight,
  ChevronDown,
  Building,
  Building2,
  Users,
  Plus,
  Move,
  Edit,
  Trash2,
  Eye,
  MapPin,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Expand,
  Compress,
  Download,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';
import { Organization, organizationsEnhancedApi } from '@/lib/api/organizations-enhanced.api';
import { useDeleteConfirmation } from '@/components/common/ConfirmationDialog';

interface OrganizationHierarchyTreeProps {
  organizations: Organization[];
  onOrganizationUpdate: () => Promise<void>;
}

interface TreeNode extends Organization {
  children: TreeNode[];
  level: number;
  isExpanded: boolean;
}

interface DraggableOrganizationProps {
  node: TreeNode;
  onToggleExpand: (nodeId: string) => void;
  onOrganizationAction: (action: string, organization: Organization) => void;
  searchQuery: string;
  showMetrics: boolean;
}

const DraggableOrganization: React.FC<DraggableOrganizationProps> = ({
  node,
  onToggleExpand,
  onOrganizationAction,
  searchQuery,
  showMetrics
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isHighlighted = searchQuery && (
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Hospital': return 'bg-blue-100 text-blue-800';
      case 'Clinic': return 'bg-green-100 text-green-800';
      case 'Department': return 'bg-purple-100 text-purple-800';
      case 'Unit': return 'bg-orange-100 text-orange-800';
      case 'Branch': return 'bg-teal-100 text-teal-800';
      case 'Subsidiary': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        mb-2 
        ${isHighlighted ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        ${isDragging ? 'z-50' : ''}
      `}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {/* Drag Handle */}
            <div 
              {...attributes}
              {...listeners}
              className="cursor-move p-1 hover:bg-gray-100 rounded"
            >
              <Move className="w-4 h-4 text-gray-400" />
            </div>

            {/* Indentation for hierarchy level */}
            <div style={{ width: node.level * 20 }} />

            {/* Expand/Collapse Button */}
            {node.children.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleExpand(node.id)}
                className="p-1 h-6 w-6"
              >
                {node.isExpanded ? 
                  <ChevronDown className="w-4 h-4" /> : 
                  <ChevronRight className="w-4 h-4" />
                }
              </Button>
            )}

            {/* Organization Icon */}
            <div className="flex-shrink-0">
              {node.type.category === 'Hospital' ? (
                <Building className="w-5 h-5 text-blue-600" />
              ) : node.type.category === 'Department' ? (
                <Building2 className="w-5 h-5 text-purple-600" />
              ) : (
                <Building className="w-5 h-5 text-gray-600" />
              )}
            </div>

            {/* Organization Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-gray-900">{node.name}</h4>
                <Badge className={getStatusColor(node.status)}>
                  {node.status}
                </Badge>
                <Badge className={getTypeColor(node.type.category)}>
                  {node.type.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {node.code}
                </Badge>
                {node.level > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Level {node.level}
                  </Badge>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {node.analytics.totalEmployees}
                </div>
                <div className="flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  {node.locations.length}
                </div>
                {showMetrics && (
                  <>
                    <div className="flex items-center">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {formatCurrency(node.analytics.totalRevenue)}
                    </div>
                    <div className={`flex items-center ${getPerformanceColor(
                      node.analytics.performance.reduce((sum, p) => sum + p.value, 0) / Math.max(node.analytics.performance.length, 1)
                    )}`}>
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {Math.round(
                        node.analytics.performance.reduce((sum, p) => sum + p.value, 0) / Math.max(node.analytics.performance.length, 1)
                      )}%
                    </div>
                  </>
                )}
                {node.children.length > 0 && (
                  <span className="text-gray-500">
                    {node.children.length} child{node.children.length !== 1 ? 'ren' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Action Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOrganizationAction('view', node)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOrganizationAction('edit', node)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOrganizationAction('addChild', node)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Child
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onOrganizationAction('delete', node)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const OrganizationHierarchyTree: React.FC<OrganizationHierarchyTreeProps> = ({
  organizations,
  onOrganizationUpdate
}) => {
  const { confirmDelete, ConfirmationComponent } = useDeleteConfirmation();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showMetrics, setShowMetrics] = useState(true);
  const [draggedOrganization, setDraggedOrganization] = useState<Organization | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Build tree structure from flat organization list
  const buildTree = useMemo(() => {
    const organizationMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // First, create all nodes
    organizations.forEach(org => {
      organizationMap.set(org.id, {
        ...org,
        children: [],
        level: 0,
        isExpanded: expandedNodes.has(org.id)
      });
    });

    // Then, build the hierarchy
    organizations.forEach(org => {
      const node = organizationMap.get(org.id)!;
      
      if (org.hierarchy.parentId && organizationMap.has(org.hierarchy.parentId)) {
        const parent = organizationMap.get(org.hierarchy.parentId)!;
        parent.children.push(node);
        node.level = parent.level + 1;
      } else {
        rootNodes.push(node);
      }
    });

    // Sort nodes by hierarchy order at each level
    const sortNodeChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.hierarchy.order - b.hierarchy.order);
      nodes.forEach(node => sortNodeChildren(node.children));
    };

    sortNodeChildren(rootNodes);
    return rootNodes;
  }, [organizations, expandedNodes]);

  // Flatten tree for display while respecting expanded state
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    
    nodes.forEach(node => {
      // Apply filters
      const matchesSearch = !searchQuery || 
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = !filterType || node.type.category === filterType;
      const matchesStatus = !filterStatus || node.status === filterStatus;

      if (matchesSearch && matchesType && matchesStatus) {
        result.push(node);
      }

      // Recursively add children if node is expanded
      if (node.isExpanded || searchQuery) { // Show all matches when searching
        result.push(...flattenTree(node.children));
      }
    });

    return result;
  };

  const displayedNodes = flattenTree(buildTree);

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    const allNodeIds = organizations.map(org => org.id);
    setExpandedNodes(new Set(allNodeIds));
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleDragStart = (event: DragStartEvent) => {
    const organization = organizations.find(org => org.id === event.active.id);
    setDraggedOrganization(organization || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedOrganization(null);

    if (!over || active.id === over.id) return;

    const activeOrg = organizations.find(org => org.id === active.id);
    const overOrg = organizations.find(org => org.id === over.id);

    if (!activeOrg || !overOrg) return;

    try {
      // Move organization to new parent
      await organizationsEnhancedApi.moveOrganization(activeOrg.id, overOrg.id);
      await onOrganizationUpdate();
    } catch (error) {
      console.error('Error moving organization:', error);
    }
  };

  const handleOrganizationAction = async (action: string, organization: Organization) => {
    switch (action) {
      case 'view':
        // Handle view action
        break;
      case 'edit':
        // Handle edit action
        break;
      case 'addChild':
        // Handle add child action
        break;
      case 'delete':
        confirmDelete(organization.name, async () => {
          try {
            await organizationsEnhancedApi.deleteOrganization(organization.id);
            await onOrganizationUpdate();
          } catch (error) {
            console.error('Error deleting organization:', error);
          }
        });
        break;
    }
  };

  const exportHierarchy = () => {
    organizationsEnhancedApi.exportOrganizations('xlsx', {
      includeHierarchy: true,
      includeAnalytics: true
    });
  };

  return (
    <div className="space-y-6">
      <ConfirmationComponent />
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <TreePine className="w-5 h-5 mr-2 text-green-600" />
              Organization Hierarchy
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
              >
                <Expand className="w-4 h-4 mr-2" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCollapseAll}
              >
                <Compress className="w-4 h-4 mr-2" />
                Collapse All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportHierarchy}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search organizations in hierarchy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="Hospital">Hospital</SelectItem>
                  <SelectItem value="Clinic">Clinic</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
                  <SelectItem value="Unit">Unit</SelectItem>
                  <SelectItem value="Branch">Branch</SelectItem>
                  <SelectItem value="Subsidiary">Subsidiary</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showMetrics ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMetrics(!showMetrics)}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Metrics
              </Button>
            </div>
          </div>

          {/* Organization Count */}
          <div className="text-sm text-gray-600">
            Showing {displayedNodes.length} of {organizations.length} organizations
          </div>
        </CardContent>
      </Card>

      {/* Hierarchy Tree */}
      <Card>
        <CardContent className="p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={displayedNodes.map(node => node.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {displayedNodes.map((node) => (
                  <DraggableOrganization
                    key={node.id}
                    node={node}
                    onToggleExpand={handleToggleExpand}
                    onOrganizationAction={handleOrganizationAction}
                    searchQuery={searchQuery}
                    showMetrics={showMetrics}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {draggedOrganization && (
                <div className="bg-white border rounded-lg shadow-lg p-4 max-w-md">
                  <div className="flex items-center space-x-3">
                    <Building className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-semibold">{draggedOrganization.name}</h4>
                      <p className="text-sm text-gray-600">{draggedOrganization.code}</p>
                    </div>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {displayedNodes.length === 0 && (
            <div className="text-center py-12">
              <TreePine className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No organizations found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || filterType || filterStatus
                  ? 'No organizations match your current filters.'
                  : 'No organizations have been created yet.'}
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hierarchy Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {buildTree.length}
              </div>
              <div className="text-sm text-gray-600">Root Organizations</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.max(...organizations.map(org => org.hierarchy.level), 0)}
              </div>
              <div className="text-sm text-gray-600">Maximum Depth</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {organizations.filter(org => org.hierarchy.children.length > 0).length}
              </div>
              <div className="text-sm text-gray-600">Parent Organizations</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {organizations.filter(org => org.hierarchy.children.length === 0).length}
              </div>
              <div className="text-sm text-gray-600">Leaf Organizations</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrganizationHierarchyTree;