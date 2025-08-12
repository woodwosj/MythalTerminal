import React, { useState, useEffect } from 'react';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_at: Date;
  updated_at: Date;
  due_date?: Date;
  tags?: string[];
}

interface PlannerProps {
  projectPath: string;
}

const Planner: React.FC<PlannerProps> = ({ projectPath }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in-progress' | 'done'>('all');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [projectPath]);

  const loadTasks = async () => {
    // For now, use local state. In full implementation, would load from database
    const mockTasks: Task[] = [
      {
        id: 1,
        title: 'Implement ConPort integration',
        description: 'Complete the ConPort knowledge graph integration',
        status: 'in-progress',
        priority: 'high',
        created_at: new Date(),
        updated_at: new Date(),
        tags: ['conport', 'integration']
      },
      {
        id: 2,
        title: 'Add semantic search UI',
        description: 'Build user interface for ConPort semantic search',
        status: 'todo',
        priority: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
        tags: ['ui', 'search']
      }
    ];
    setTasks(mockTasks);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now(),
      title: newTaskTitle,
      description: newTaskDescription,
      status: 'todo',
      priority: newTaskPriority,
      created_at: new Date(),
      updated_at: new Date(),
      tags: []
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setIsAddingTask(false);
  };

  const handleStatusChange = (taskId: number, newStatus: Task['status']) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus, updated_at: new Date() } : task
    ));
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm('Delete this task?')) {
      setTasks(tasks.filter(task => task.id !== taskId));
    }
  };

  const filteredTasks = tasks.filter(task => 
    filterStatus === 'all' || task.status === filterStatus
  );

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-400 border-red-400';
      case 'medium': return 'text-yellow-400 border-yellow-400';
      case 'low': return 'text-green-400 border-green-400';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'todo': return '⭕';
      case 'in-progress': return '🔄';
      case 'done': return '✅';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">📋 Project Planner</h2>
            <p className="text-xs text-gray-400 mt-1">Manage tasks and track progress</p>
          </div>
          <button
            onClick={() => setIsAddingTask(!isAddingTask)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            ➕ New Task
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      {isAddingTask && (
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full px-3 py-2 mb-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          <textarea
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Task description (optional)..."
            className="w-full px-3 py-2 mb-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            rows={2}
          />
          <div className="flex items-center space-x-2">
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
              className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <button
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim()}
              className="px-4 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              ✅ Add Task
            </button>
            <button
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskTitle('');
                setNewTaskDescription('');
              }}
              className="px-4 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Filter:</span>
          {(['all', 'todo', 'in-progress', 'done'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filterStatus === status 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">📝 No tasks found</p>
            <p className="text-sm">
              {filterStatus === 'all' 
                ? 'Click "New Task" to add your first task'
                : `No ${filterStatus} tasks`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div key={task.id} className="p-3 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getStatusIcon(task.status)}</span>
                      <h3 className="font-semibold">{task.title}</h3>
                      <span className={`text-xs px-2 py-1 border rounded ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-400 mt-1 ml-7">{task.description}</p>
                    )}
                    <div className="flex items-center space-x-3 mt-2 ml-7">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                        className="text-xs px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      {task.tags?.map((tag, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-blue-900 rounded">
                          #{tag}
                        </span>
                      ))}
                      <span className="text-xs text-gray-500">
                        Updated: {new Date(task.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="ml-2 px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded transition-colors"
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Bar */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Total: {tasks.length} tasks</span>
          <div className="flex items-center space-x-3">
            <span>📋 Todo: {tasks.filter(t => t.status === 'todo').length}</span>
            <span>🔄 In Progress: {tasks.filter(t => t.status === 'in-progress').length}</span>
            <span>✅ Done: {tasks.filter(t => t.status === 'done').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planner;