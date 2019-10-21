# Generated by Django 2.2.5 on 2019-10-21 13:37

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models.functions.text
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0011_update_proxy_permissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('is_active', models.BooleanField(default=True, help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.', verbose_name='active')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('full_name', models.CharField(max_length=200)),
                ('had_catalog', models.BooleanField(default=False)),
                ('verified', models.BooleanField(default=False)),
                ('last_seen', models.DateTimeField(auto_now_add=True)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.Group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.Permission', verbose_name='user permissions')),
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
                ('stub', models.CharField(blank=True, default='', max_length=50, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('lc_name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='Backblaze',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key_id', models.CharField(max_length=30)),
                ('key', models.CharField(max_length=40)),
                ('bucket', models.CharField(max_length=50)),
                ('path', models.CharField(max_length=200)),
            ],
        ),
        migrations.CreateModel(
            name='Catalog',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('backblaze', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='catalogs', to='api.Backblaze')),
            ],
        ),
        migrations.CreateModel(
            name='Server',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ],
        ),
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('lc_name', models.CharField(max_length=100)),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tags', to='api.Catalog')),
                ('parent', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='api.Tag')),
            ],
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=200)),
                ('lc_name', models.CharField(max_length=200)),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='people', to='api.Catalog')),
            ],
        ),
        migrations.CreateModel(
            name='Media',
            fields=[
                ('id', models.CharField(max_length=30, primary_key=True, serialize=False)),
                ('processed', models.BooleanField(default=False)),
                ('title', models.CharField(blank=True, max_length=200)),
                ('filename', models.CharField(blank=True, max_length=50)),
                ('longitude', models.FloatField(null=True)),
                ('latitude', models.FloatField(null=True)),
                ('taken', models.DateTimeField(null=True)),
                ('uploaded', models.DateTimeField(auto_now_add=True)),
                ('modified', models.DateTimeField(auto_now_add=True)),
                ('mimetype', models.CharField(max_length=50)),
                ('width', models.IntegerField(default=0)),
                ('height', models.IntegerField(default=0)),
                ('orientation', models.IntegerField(default=1)),
                ('storage_filename', models.CharField(max_length=50)),
                ('storage_id', models.CharField(blank=True, default='', max_length=200)),
                ('albums', models.ManyToManyField(related_name='media', to='api.Album')),
                ('catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media', to='api.Catalog')),
                ('people', models.ManyToManyField(related_name='media', to='api.Person')),
                ('tags', models.ManyToManyField(related_name='media', to='api.Tag')),
            ],
        ),
        migrations.AddField(
            model_name='catalog',
            name='server',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='catalogs', to='api.Server'),
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
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name='tag',
            constraint=models.CheckConstraint(check=models.Q(lc_name=django.db.models.functions.text.Lower('name')), name='ensure_lc_name_correct'),
        ),
        migrations.AddConstraint(
            model_name='tag',
            constraint=models.UniqueConstraint(fields=('catalog', 'lc_name'), name='unique_tag_name'),
        ),
        migrations.AddConstraint(
            model_name='person',
            constraint=models.CheckConstraint(check=models.Q(lc_name=django.db.models.functions.text.Lower('full_name')), name='ensure_lc_name_correct'),
        ),
        migrations.AddConstraint(
            model_name='person',
            constraint=models.UniqueConstraint(fields=('catalog', 'lc_name'), name='unique_person_name'),
        ),
        migrations.AddConstraint(
            model_name='album',
            constraint=models.CheckConstraint(check=models.Q(lc_name=django.db.models.functions.text.Lower('name')), name='ensure_lc_name_correct'),
        ),
        migrations.AddConstraint(
            model_name='album',
            constraint=models.UniqueConstraint(condition=models.Q(parent__isnull=True), fields=('catalog',), name='single_root_album'),
        ),
        migrations.AddConstraint(
            model_name='album',
            constraint=models.UniqueConstraint(fields=('catalog', 'parent', 'lc_name'), name='unique_album_name'),
        ),
        migrations.AddConstraint(
            model_name='access',
            constraint=models.UniqueConstraint(fields=('user', 'catalog'), name='unique_owners'),
        ),
    ]
