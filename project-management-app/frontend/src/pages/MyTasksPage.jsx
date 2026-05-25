import TaskListPage from './TaskListPage';

// Halaman task personal berdasarkan PIC/lead user login.
function MyTasksPage() {
  return (
    <TaskListPage
      defaultFilters={{ my_tasks: 'true' }}
      description="Daftar task yang melibatkan user login sebagai PIC atau lead approval."
      hideFilters
      kicker="Personal Work"
      title="My Tasks"
    />
  );
}

export default MyTasksPage;
