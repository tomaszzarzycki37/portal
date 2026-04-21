import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function ProfilePage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    bio: '',
    location: '',
    phone: '',
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true)
        const response = await api.get('/users/me/')
        setUser(response.data)
        setFormData({
          username: response.data.username || '',
          email: response.data.email || '',
          first_name: response.data.first_name || '',
          last_name: response.data.last_name || '',
          bio: response.data.profile?.bio || '',
          location: response.data.profile?.location || '',
          phone: response.data.profile?.phone || '',
        })
        if (response.data.profile?.avatar) {
          setAvatarPreview(response.data.profile.avatar)
        }
      } catch (err) {
        setError(t.profile.loadError || 'Failed to load profile')
        console.error('Error loading user data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadUserData()
  }, [t])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setMessage('')
      setError('')

      // Prepare form data for submission
      const submitData = new FormData()

      // Add profile fields
      if (formData.bio) submitData.append('bio', formData.bio)
      if (formData.location) submitData.append('location', formData.location)
      if (formData.phone) submitData.append('phone', formData.phone)

      // Add avatar if selected
      if (avatarFile) {
        submitData.append('avatar', avatarFile)
      }

      // Update profile
      const profileResponse = await api.post('/users/update_profile/', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Update user info separately
      const userUpdateData = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
      }

      await api.patch(`/users/${ user.id }/`, userUpdateData)

      setMessage(t.profile.savedSuccess || 'Profile updated successfully!')
      setAvatarFile(null)

      // Reload user data
      const response = await api.get('/users/me/')
      setUser(response.data)
      setFormData({
        username: response.data.username || '',
        email: response.data.email || '',
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        bio: response.data.profile?.bio || '',
        location: response.data.profile?.location || '',
        phone: response.data.profile?.phone || '',
      })
      if (response.data.profile?.avatar) {
        setAvatarPreview(response.data.profile.avatar)
      }
    } catch (err) {
      setError(t.profile.saveError || 'Failed to save profile')
      console.error('Error saving profile:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page-card">{ t.pages.loading }</div>
  }

  if (!user) {
    return (
      <div className="page-card">
        <p className="form-error">{ t.profile.notLoggedIn || 'Please log in to view your profile' }</p>
      </div>
    )
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1 className="profile-title">{ t.profile.myProfile || 'My Profile' }</h1>

        { message && <div className="form-success">{ message }</div> }
        { error && <div className="form-error">{ error }</div> }

        <form onSubmit={ handleSaveProfile } className="profile-form">
          {/* Avatar Section */}
          <section className="profile-avatar-section">
            <div className="avatar-preview-container">
              { avatarPreview ? (
                <img src={ avatarPreview } alt="Avatar preview" className="avatar-preview" />
              ) : (
                <div className="avatar-placeholder">
                  { formData.first_name?.charAt(0)?.toUpperCase() ||
                    formData.username?.charAt(0)?.toUpperCase() ||
                    '👤' }
                </div>
              ) }
            </div>
            <div className="avatar-upload-group">
              <label htmlFor="avatar-upload" className="profile-label">
                { t.profile.avatar || 'Profile Photo' }
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={ handleAvatarChange }
                className="file-input"
              />
              <p className="file-hint">{ t.profile.photoHint || 'JPG, PNG up to 5MB' }</p>
            </div>
          </section>

          {/* Personal Information */}
          <section className="profile-form-section">
            <h2 className="profile-section-title">{ t.profile.personalInfo || 'Personal Information' }</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username" className="profile-label">
                  { t.profile.username || 'Username' }
                </label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={ formData.username }
                  disabled
                  className="form-input disabled"
                />
                <p className="field-hint">{ t.profile.usernameHint || 'Username cannot be changed' }</p>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="profile-label">
                  { t.profile.email || 'Email' }
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={ formData.email }
                  onChange={ handleInputChange }
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name" className="profile-label">
                  { t.profile.firstName || 'First Name' }
                </label>
                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  value={ formData.first_name }
                  onChange={ handleInputChange }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="last_name" className="profile-label">
                  { t.profile.lastName || 'Last Name' }
                </label>
                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  value={ formData.last_name }
                  onChange={ handleInputChange }
                  className="form-input"
                />
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="profile-form-section">
            <h2 className="profile-section-title">{ t.profile.contactInfo || 'Contact Information' }</h2>

            <div className="form-group">
              <label htmlFor="phone" className="profile-label">
                { t.profile.phone || 'Phone' }
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={ formData.phone }
                onChange={ handleInputChange }
                className="form-input"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location" className="profile-label">
                { t.profile.location || 'Location' }
              </label>
              <input
                id="location"
                type="text"
                name="location"
                value={ formData.location }
                onChange={ handleInputChange }
                className="form-input"
                placeholder="City, Country"
              />
            </div>
          </section>

          {/* Bio */}
          <section className="profile-form-section">
            <h2 className="profile-section-title">{ t.profile.bio || 'About You' }</h2>

            <div className="form-group">
              <label htmlFor="bio" className="profile-label">
                { t.profile.bioLabel || 'Bio' }
              </label>
              <textarea
                id="bio"
                name="bio"
                value={ formData.bio }
                onChange={ handleInputChange }
                rows="5"
                className="form-textarea"
                placeholder={ t.profile.bioPlaceholder || 'Tell us about yourself, your interests in cars, or your opinion...' }
              />
              <p className="char-count">
                { formData.bio.length }/500
              </p>
            </div>
          </section>

          {/* Submit Button */}
          <div className="profile-form-actions">
            <button
              type="submit"
              disabled={ saving }
              className="btn btn-primary btn-large"
            >
              { saving ? t.pages.loading : t.profile.saveChanges || 'Save Changes' }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
