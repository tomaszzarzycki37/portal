from django.conf import settings
from django.db import models


class SiteTextOverride(models.Model):
	LANG_CHOICES = [
		('en', 'English'),
		('pl', 'Polski'),
	]

	key = models.CharField(max_length=180)
	lang = models.CharField(max_length=2, choices=LANG_CHOICES)
	value = models.TextField(blank=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['lang', 'key']
		unique_together = ('key', 'lang')

	def __str__(self):
		return f"{self.lang}:{self.key}"


class AdminActionLog(models.Model):
	ACTION_TEXT_CREATE = 'text_create'
	ACTION_TEXT_EDIT = 'text_edit'
	ACTION_TEXT_DELETE = 'text_delete'
	ACTION_BRAND_CREATE = 'brand_create'
	ACTION_BRAND_UPDATE = 'brand_update'
	ACTION_BRAND_DELETE = 'brand_delete'
	ACTION_MODEL_CREATE = 'model_create'
	ACTION_MODEL_UPDATE = 'model_update'
	ACTION_MODEL_DELETE = 'model_delete'
	ACTION_REVIEW_CREATE = 'review_create'
	ACTION_REVIEW_UPDATE = 'review_update'
	ACTION_REVIEW_DELETE = 'review_delete'
	ACTION_USER_UPDATE = 'user_update'
	ACTION_USER_DELETE = 'user_delete'
	ACTION_USER_TEMP_PASSWORD = 'user_temp_password'
	ACTION_FILE_UPLOAD = 'file_upload'

	ACTION_TYPE_CHOICES = [
		(ACTION_TEXT_CREATE, 'Text create'),
		(ACTION_TEXT_EDIT, 'Text edit'),
		(ACTION_TEXT_DELETE, 'Text delete'),
		(ACTION_BRAND_CREATE, 'Brand create'),
		(ACTION_BRAND_UPDATE, 'Brand update'),
		(ACTION_BRAND_DELETE, 'Brand delete'),
		(ACTION_MODEL_CREATE, 'Model create'),
		(ACTION_MODEL_UPDATE, 'Model update'),
		(ACTION_MODEL_DELETE, 'Model delete'),
		(ACTION_REVIEW_CREATE, 'Review create'),
		(ACTION_REVIEW_UPDATE, 'Review update'),
		(ACTION_REVIEW_DELETE, 'Review delete'),
		(ACTION_USER_UPDATE, 'User update'),
		(ACTION_USER_DELETE, 'User delete'),
		(ACTION_USER_TEMP_PASSWORD, 'Temporary password'),
		(ACTION_FILE_UPLOAD, 'File upload'),
	]

	actor = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='admin_action_logs',
	)
	actor_username = models.CharField(max_length=150, blank=True)
	action_type = models.CharField(max_length=40, choices=ACTION_TYPE_CHOICES)
	object_type = models.CharField(max_length=40, blank=True)
	object_id = models.CharField(max_length=64, blank=True)
	object_label = models.CharField(max_length=255, blank=True)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f"{self.actor_username or 'system'}: {self.action_type} ({self.created_at.isoformat()})"


class SiteRequestLog(models.Model):
	method = models.CharField(max_length=10, default='GET')
	path = models.CharField(max_length=300, db_index=True)
	status_code = models.PositiveSmallIntegerField(default=0, db_index=True)
	ip_address = models.CharField(max_length=64, blank=True, db_index=True)
	user_agent = models.CharField(max_length=400, blank=True)
	referer = models.CharField(max_length=400, blank=True)
	is_bot = models.BooleanField(default=False, db_index=True)
	response_ms = models.PositiveIntegerField(blank=True, null=True)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='site_request_logs',
	)
	created_at = models.DateTimeField(auto_now_add=True, db_index=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['created_at', 'is_bot']),
			models.Index(fields=['path', 'created_at']),
		]

	def __str__(self):
		return f"{self.method} {self.path} ({self.status_code})"


class SecurityEvent(models.Model):
	EVENT_FAILED_LOGIN = 'failed_login'
	EVENT_BLOCKED_LOGIN = 'blocked_login'
	EVENT_UNAUTHORIZED_API = 'unauthorized_api'
	EVENT_SUSPICIOUS_ADMIN = 'suspicious_admin'
	EVENT_IP_BLOCKED = 'ip_blocked'
	EVENT_IP_UNBLOCKED = 'ip_unblocked'
	EVENT_MAINTENANCE_ON = 'maintenance_on'
	EVENT_MAINTENANCE_OFF = 'maintenance_off'
	EVENT_FORCE_LOGOUT = 'force_logout'

	EVENT_TYPE_CHOICES = [
		(EVENT_FAILED_LOGIN, 'Failed login'),
		(EVENT_BLOCKED_LOGIN, 'Blocked login'),
		(EVENT_UNAUTHORIZED_API, 'Unauthorized API'),
		(EVENT_SUSPICIOUS_ADMIN, 'Suspicious admin action'),
		(EVENT_IP_BLOCKED, 'IP blocked'),
		(EVENT_IP_UNBLOCKED, 'IP unblocked'),
		(EVENT_MAINTENANCE_ON, 'Maintenance enabled'),
		(EVENT_MAINTENANCE_OFF, 'Maintenance disabled'),
		(EVENT_FORCE_LOGOUT, 'Force logout'),
	]

	event_type = models.CharField(max_length=40, choices=EVENT_TYPE_CHOICES, db_index=True)
	username_attempted = models.CharField(max_length=150, blank=True)
	ip_address = models.CharField(max_length=64, blank=True, db_index=True)
	user_agent = models.CharField(max_length=400, blank=True)
	path = models.CharField(max_length=300, blank=True)
	metadata = models.JSONField(default=dict, blank=True)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='security_events',
	)
	created_at = models.DateTimeField(auto_now_add=True, db_index=True)

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f"{self.event_type} @ {self.ip_address or 'unknown'}"


class BlockedIP(models.Model):
	ip_address = models.CharField(max_length=64, unique=True)
	reason = models.CharField(max_length=255, blank=True)
	is_active = models.BooleanField(default=True, db_index=True)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='blocked_ips',
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f"{self.ip_address} ({'active' if self.is_active else 'inactive'})"


class SiteSetting(models.Model):
	key = models.CharField(max_length=100, unique=True)
	value = models.TextField(blank=True)
	updated_at = models.DateTimeField(auto_now=True)
	updated_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='site_settings_updated',
	)

	class Meta:
		ordering = ['key']

	def __str__(self):
		return self.key

	@classmethod
	def get_value(cls, key, default=''):
		row = cls.objects.filter(key=key).first()
		if not row:
			return default
		return row.value

	@classmethod
	def set_value(cls, key, value, user=None):
		row, _created = cls.objects.get_or_create(key=key)
		row.value = '' if value is None else str(value)
		if user is not None and getattr(user, 'is_authenticated', False):
			row.updated_by = user
		row.save()
		return row
