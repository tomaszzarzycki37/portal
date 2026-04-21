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
