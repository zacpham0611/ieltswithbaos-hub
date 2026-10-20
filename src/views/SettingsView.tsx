import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  ShieldCheck,
  Building,
  Key,
  CheckCircle,
  Lock,
  RotateCcw,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentUser, switchUser, registerUser, users } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [targetBand, setTargetBand] = useState(currentUser.targetBand || '7.5');

  // Registration form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'teacher' | 'student'>('teacher');
  const [showRegModal, setShowRegModal] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    currentUser.name = name;
    currentUser.email = email;
    currentUser.bio = bio;
    if (currentUser.role === 'student') currentUser.targetBand = targetBand;
    alert('Profile preferences updated.');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) return;
    registerUser(regName, regEmail, regRole);
    setShowRegModal(false);
    setRegName('');
    setRegEmail('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & Privacy Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your personal details, role configurations, and access security.
        </p>
      </div>

      {/* Role & Privacy Security Badge */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Privacy-First Multi-Teacher Architecture</h3>
            <p className="text-xs text-slate-500">
              Active Role: <strong className="uppercase text-blue-700">{currentUser.role}</strong>. Data is isolated by teacher ID and enrollment authorization.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowRegModal(true)}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
        >
          + Register New Persona
        </button>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="flex items-center space-x-4 pb-4 border-b border-slate-100">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border border-slate-200"
            />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{currentUser.name}</h2>
              <p className="text-xs text-slate-400 capitalize">{currentUser.role} Account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
              />
            </div>
          </div>

          {currentUser.role === 'student' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target IELTS Band</label>
              <input
                type="text"
                value={targetBand}
                onChange={(e) => setTargetBand(e.target.value)}
                placeholder="e.g. 7.0 or 7.5"
                className="w-full sm:w-48 p-2.5 border border-slate-300 rounded-lg outline-hidden"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Biography / Credentials</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Teaching credentials or academic goals..."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
            >
              Save Profile Settings
            </button>
          </div>
        </form>
      </div>

      {/* Modal: Register New Persona */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Create New User Account</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new teacher or student account to test multi-tenant access barriers and isolated course views.
            </p>

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Arthur Conan"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. arthur@ieltshub.edu"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white font-semibold"
                >
                  <option value="teacher">Independent IELTS Teacher</option>
                  <option value="student">Student Learner</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Create & Log In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
