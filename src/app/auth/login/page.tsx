import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">U</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Upsalla Kinderpark</h1>
          <p className="text-sm text-gray-500 mt-1">Mitarbeiter-Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
