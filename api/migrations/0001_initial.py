# Generated by Django 3.0.2 on 2020-06-02 09:21

import api.constraints
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models.expressions
import django.db.models.functions.comparison
import django.db.models.functions.text
import django.db.models.manager


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('full_name', models.CharField(max_length=200)),
                ('had_catalog', models.BooleanField(default=False)),
                ('verified', models.BooleanField(default=False)),
                ('date_joined', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['full_name'],
            },
        ),
        migrations.CreateModel(
            name='Access',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ],
        ),
        migrations.CreateModel(
            name='Album',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('stub', models.CharField(default=None, max_length=50, null=True, unique=True)),
                ('name', models.CharField(max_length=100)),
            ],
            managers=[
                ('descendants_manager', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='Catalog',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='Media',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('storage_id', models.CharField(blank=True, default='', max_length=200)),
                ('new_file', models.BooleanField(default=False)),
                ('overridden_filename', models.CharField(blank=True, max_length=200, null=True)),
                ('media_filename', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_title', models.CharField(blank=True, max_length=200, null=True)),
                ('media_title', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_taken', models.DateTimeField(null=True)),
                ('media_taken', models.DateTimeField(null=True)),
                ('overridden_offset', models.IntegerField(null=True)),
                ('media_offset', models.IntegerField(null=True)),
                ('overridden_longitude', models.FloatField(null=True)),
                ('media_longitude', models.FloatField(null=True)),
                ('overridden_latitude', models.FloatField(null=True)),
                ('media_latitude', models.FloatField(null=True)),
                ('overridden_altitude', models.FloatField(null=True)),
                ('media_altitude', models.FloatField(null=True)),
                ('overridden_location', models.CharField(blank=True, max_length=200, null=True)),
                ('media_location', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_city', models.CharField(blank=True, max_length=200, null=True)),
                ('media_city', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_state', models.CharField(blank=True, max_length=200, null=True)),
                ('media_state', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_country', models.CharField(blank=True, max_length=200, null=True)),
                ('media_country', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_orientation', models.IntegerField(null=True)),
                ('media_orientation', models.IntegerField(null=True)),
                ('overridden_make', models.CharField(blank=True, max_length=200, null=True)),
                ('media_make', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_model', models.CharField(blank=True, max_length=200, null=True)),
                ('media_model', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_lens', models.CharField(blank=True, max_length=200, null=True)),
                ('media_lens', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_photographer', models.CharField(blank=True, max_length=200, null=True)),
                ('media_photographer', models.CharField(blank=True, max_length=200, null=True)),
                ('overridden_aperture', models.FloatField(null=True)),
                ('media_aperture', models.FloatField(null=True)),
                ('overridden_exposure', models.FloatField(null=True)),
                ('media_exposure', models.FloatField(null=True)),
                ('overridden_iso', models.IntegerField(null=True)),
                ('media_iso', models.IntegerField(null=True)),
                ('overridden_focal_length', models.FloatField(null=True)),
                ('media_focal_length', models.FloatField(null=True)),
                ('overridden_bitrate', models.FloatField(null=True)),
                ('media_bitrate', models.FloatField(null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Storage',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ],
        ),
        migrations.CreateModel(
            name='Backblaze',
            fields=[
                ('storage_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='api.Storage')),
                ('key_id', models.CharField(max_length=30)),
                ('key', models.CharField(max_length=40)),
                ('bucket', models.CharField(max_length=50)),
                ('path', models.CharField(max_length=200)),
            ],
            bases=('api.storage',),
        ),
        migrations.CreateModel(
            name='Server',
            fields=[
                ('storage_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='api.Storage')),
            ],
            bases=('api.storage',),
        ),
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tags', to='api.Catalog')),
                ('parent', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='api.Tag')),
            ],
            managers=[
                ('descendants_manager', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='people', to='api.Catalog')),
            ],
        ),
        migrations.CreateModel(
            name='MediaTag',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('media', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Media')),
                ('tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Tag')),
            ],
        ),
        migrations.CreateModel(
            name='MediaPerson',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('media', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Media')),
                ('person', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Person')),
            ],
        ),
        migrations.CreateModel(
            name='MediaInfo',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('process_version', models.IntegerField(default=None)),
                ('uploaded', models.DateTimeField()),
                ('mimetype', models.CharField(max_length=50)),
                ('width', models.IntegerField(default=None)),
                ('height', models.IntegerField(default=None)),
                ('duration', models.FloatField(default=None, null=True)),
                ('file_size', models.IntegerField(default=None)),
                ('media', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='info', to='api.Media')),
            ],
        ),
        migrations.CreateModel(
            name='MediaAlbum',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('album', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Album')),
                ('media', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Media')),
            ],
        ),
        migrations.AddField(
            model_name='media',
            name='albums',
            field=models.ManyToManyField(related_name='media', through='api.MediaAlbum', to='api.Album'),
        ),
        migrations.AddField(
            model_name='media',
            name='catalog',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media', to='api.Catalog'),
        ),
        migrations.AddField(
            model_name='media',
            name='people',
            field=models.ManyToManyField(related_name='media', through='api.MediaPerson', to='api.Person'),
        ),
        migrations.AddField(
            model_name='media',
            name='tags',
            field=models.ManyToManyField(related_name='media', through='api.MediaTag', to='api.Tag'),
        ),
        migrations.AddField(
            model_name='catalog',
            name='storage',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='catalogs', to='api.Storage'),
        ),
        migrations.AddField(
            model_name='catalog',
            name='users',
            field=models.ManyToManyField(related_name='catalogs', through='api.Access', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='album',
            name='catalog',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='albums', to='api.Catalog'),
        ),
        migrations.AddField(
            model_name='album',
            name='parent',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='albums', to='api.Album'),
        ),
        migrations.AddField(
            model_name='access',
            name='catalog',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.Catalog'),
        ),
        migrations.AddField(
            model_name='access',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name='tag',
            constraint=api.constraints.UniqueWithExpressionsConstraint(expressions=[django.db.models.functions.comparison.Coalesce(django.db.models.expressions.F('parent'), django.db.models.expressions.RawSQL("'NONE'", [])), django.db.models.functions.text.Lower(django.db.models.expressions.F('name'))], fields=['catalog'], name='unique_tag_name'),
        ),
        migrations.AddConstraint(
            model_name='person',
            constraint=api.constraints.UniqueWithExpressionsConstraint(expressions=[django.db.models.functions.text.Lower(django.db.models.expressions.F('name'))], fields=['catalog'], name='unique_person_name'),
        ),
        migrations.AddConstraint(
            model_name='mediatag',
            constraint=models.UniqueConstraint(fields=('media', 'tag'), name='unique_tags'),
        ),
        migrations.AddConstraint(
            model_name='mediaperson',
            constraint=models.UniqueConstraint(fields=('media', 'person'), name='unique_people'),
        ),
        migrations.AddConstraint(
            model_name='mediaalbum',
            constraint=models.UniqueConstraint(fields=('media', 'album'), name='unique_albums'),
        ),
        migrations.AddConstraint(
            model_name='album',
            constraint=api.constraints.UniqueWithExpressionsConstraint(expressions=[django.db.models.functions.comparison.Coalesce(django.db.models.expressions.F('parent'), django.db.models.expressions.RawSQL("'NONE'", [])), django.db.models.functions.text.Lower(django.db.models.expressions.F('name'))], fields=[], name='unique_album_name'),
        ),
        migrations.AddConstraint(
            model_name='access',
            constraint=models.UniqueConstraint(fields=('user', 'catalog'), name='unique_owners'),
        ),
    ]
