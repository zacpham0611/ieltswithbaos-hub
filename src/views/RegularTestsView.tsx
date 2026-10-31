import React from 'react';
import { useApp } from '../context/AppContext';
import { TeacherRegularTestsView } from './regular-tests/TeacherRegularTestsView';
import { StudentRegularTestsView } from './regular-tests/StudentRegularTestsView';

export const RegularTestsView: React.FC = () => {
  const { currentUser } = useApp();

  if (!currentUser) return null;

  return currentUser.role === 'teacher' ? (
    <TeacherRegularTestsView />
  ) : (
    <StudentRegularTestsView />
  );
};
