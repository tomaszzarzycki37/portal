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
