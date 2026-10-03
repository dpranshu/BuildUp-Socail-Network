import 'dart:io';
import 'dart:math';

import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models.dart';

class SocialPostPage {
  const SocialPostPage({
    required this.posts,
    required this.hasMore,
    this.cursorCreatedAt,
    this.cursorId,
  });

  final List<SocialPost> posts;
  final bool hasMore;
  final String? cursorCreatedAt;
  final String? cursorId;
}

class SocialNotificationPage {
  const SocialNotificationPage({
    required this.notifications,
    required this.hasMore,
    this.cursorCreatedAt,
    this.cursorId,
  });

  final List<JsonMap> notifications;
  final bool hasMore;
  final String? cursorCreatedAt;
  final String? cursorId;
}

class AppRepository {
  AppRepository(this.client);

  final SupabaseClient client;
  String get userId {
    final id = client.auth.currentUser?.id;
    if (id == null) throw const AuthException('Please sign in to continue.');
    return id;
  }

  static const postSelect =
      'id,author_id,body,tags,media_urls,media_type,post_kind,opportunity_kind,'
      'opportunity_title,opportunity_role,opportunity_skills,opportunity_commitment,'
      'opportunity_work_mode,opportunity_location,opportunity_compensation,'
      'opportunity_status,likes_count,comments_count,reposts_count,created_at,'
      'author:profiles!posts_author_id_fkey(display_name,handle,bio,avatar_url,is_verified)';

  Future<SocialPost?> loadPost(String postId) async {
    final row = await client
        .from('posts')
        .select(postSelect)
        .eq('id', postId)
        .isFilter('deleted_at', null)
        .maybeSingle();
    if (row == null) return null;
    return (await _mapPosts([row], client.auth.currentUser?.id)).single;
  }

  Future<List<SocialPost>> loadFeed({
    String mode = 'for-you',
    bool collabs = false,
    String? opportunityKind,
  }) async => (await loadFeedPage(
    mode: mode,
    collabs: collabs,
    opportunityKind: opportunityKind,
    pageSize: 50,
  )).posts;

  Future<SocialPostPage> loadFeedPage({
    String mode = 'for-you',
    bool collabs = false,
    String? opportunityKind,
    int pageSize = 10,
    String? beforeCreatedAt,
    String? beforeId,
  }) async {
    if (pageSize < 1 || pageSize > 50) {
      throw const FormatException('Feed page size must be between 1 and 50.');
    }
    if ((beforeCreatedAt == null) != (beforeId == null) ||
        (beforeCreatedAt != null &&
            DateTime.tryParse(beforeCreatedAt) == null)) {
      throw const FormatException('Invalid feed cursor.');
    }
    final user = client.auth.currentUser;
    List<String>? followingIds;
    final hiddenPostIds = <String>[];
    final blockedIds = <String>[];
    if (user != null) {
      if (mode == 'following') {
        final follows = await client
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);
        followingIds = follows
            .map((row) => stringValue(row['following_id']))
            .toList();
        if (followingIds.isEmpty) {
          return const SocialPostPage(posts: [], hasMore: false);
        }
      }
      final preferences = await Future.wait([
        client.from('hidden_posts').select('post_id').eq('user_id', user.id),
        client
            .from('user_blocks')
            .select('blocked_id')
            .eq('blocker_id', user.id),
      ]);
      hiddenPostIds.addAll(
        preferences[0].map((row) => stringValue(row['post_id'])),
      );
      blockedIds.addAll(
        preferences[1].map((row) => stringValue(row['blocked_id'])),
      );
    }

    var query = client
        .from('posts')
        .select(postSelect)
        .isFilter('deleted_at', null);
    if (collabs) {
      query = query
          .eq('post_kind', 'opportunity')
          .eq('opportunity_status', 'open');
      if (opportunityKind != null && opportunityKind != 'all') {
        query = query.eq('opportunity_kind', opportunityKind);
      }
    } else {
      query = query.eq('post_kind', 'post');
    }
    if (followingIds != null) query = query.inFilter('author_id', followingIds);
    if (blockedIds.isNotEmpty) {
      query = query.not('author_id', 'in', '(${blockedIds.join(',')})');
    }
    if (hiddenPostIds.isNotEmpty) {
      query = query.not('id', 'in', '(${hiddenPostIds.join(',')})');
    }
    if (beforeCreatedAt != null && beforeId != null) {
      query = query.or(
        'created_at.lt.$beforeCreatedAt,and(created_at.eq.$beforeCreatedAt,id.lt.$beforeId)',
      );
    }
    final rows = await query
        .order('created_at', ascending: false)
        .order('id', ascending: false)
        .limit(pageSize + 1);
    final hasMore = rows.length > pageSize;
    final pageRows = rows.take(pageSize).toList();
    final lastRow = pageRows.isEmpty ? null : pageRows.last;
    return SocialPostPage(
      posts: await _mapPosts(pageRows, user?.id),
      hasMore: hasMore,
      cursorCreatedAt: hasMore ? stringValue(lastRow?['created_at']) : null,
      cursorId: hasMore ? stringValue(lastRow?['id']) : null,
    );
  }

  Future<List<SocialPost>> searchPostsAndOpportunities(String query) async {
    final normalized = query.trim().replaceAll(RegExp(r'[%_]'), ' ').trim();
    if (normalized.length < 2) return [];
    final pages = await Future.wait(
      ['body', 'opportunity_title', 'opportunity_role'].map(
        (field) => client
            .from('posts')
            .select(postSelect)
            .isFilter('deleted_at', null)
            .ilike(field, '%$normalized%')
            .order('created_at', ascending: false)
            .limit(30),
      ),
    );
    final rowsById = <String, JsonMap>{};
    for (final rows in pages) {
      for (final row in rows) {
        rowsById.putIfAbsent(stringValue(row['id']), () => row);
      }
    }
    final rows = rowsById.values.toList()
      ..sort(
        (a, b) =>
            stringValue(b['created_at'])
                .compareTo(stringValue(a['created_at'])),
      );
    return _mapPosts(rows.take(30).toList(), client.auth.currentUser?.id);
  }

  Future<List<SocialPost>> _mapPosts(List<dynamic> rows, String? uid) async {
    if (rows.isEmpty) return [];
    final ids = rows.map((row) => stringValue(row['id'])).toList();
    final results = uid == null
        ? <List<dynamic>>[[], []]
        : await Future.wait([
            client
                .from('likes')
                .select('post_id')
                .eq('user_id', uid)
                .inFilter('post_id', ids),
            client
                .from('reposts')
                .select('post_id')
                .eq('user_id', uid)
                .inFilter('post_id', ids),
          ]);
    final liked = results[0].map((row) => stringValue(row['post_id'])).toSet();
    final reposted = results[1]
        .map((row) => stringValue(row['post_id']))
        .toSet();
    final interests = uid == null
        ? <String, String>{}
        : {
            for (final row
                in await client
                    .from('collab_interests')
                    .select('post_id,status')
                    .eq('applicant_id', uid)
                    .inFilter('post_id', ids))
              stringValue(row['post_id']): stringValue(row['status']),
          };
    return rows.map((dynamic value) {
      final row = rowValue(value);
      return SocialPost.fromRow(
        row,
        isMine: row['author_id'] == uid,
        liked: liked.contains(row['id']),
        reposted: reposted.contains(row['id']),
        interestStatus: interests[row['id']],
      );
    }).toList();
  }

  Future<void> createPost({
    required String body,
    required List<String> tags,
    XFile? image,
    String mediaType = 'text',
    List<String> mediaUrls = const [],
    String postKind = 'post',
    String? opportunityKind,
    String? title,
    String? role,
    List<String> skills = const [],
    String commitment = 'flexible',
    String workMode = 'flexible',
    String location = '',
    String compensation = '',
  }) async {
    final uid = userId;
    final content = body.trim();
    final normalizedMediaUrls = mediaUrls
        .map((url) => url.trim())
        .where((url) => url.isNotEmpty)
        .toList();
    if (content.length > 1000) {
      throw const FormatException(
        'Post text must be 1,000 characters or fewer.',
      );
    }
    if (!{'text', 'image', 'video'}.contains(mediaType)) {
      throw const FormatException('Choose text, image, or video.');
    }
    if (normalizedMediaUrls.length > (image == null ? 4 : 3) ||
        normalizedMediaUrls.any((value) {
          final uri = Uri.tryParse(value);
          return uri == null || uri.scheme != 'https' || uri.host.isEmpty;
        })) {
      throw const FormatException('Use up to four valid HTTPS media links.');
    }
    if ((mediaType == 'video' && normalizedMediaUrls.isEmpty) ||
        (mediaType == 'image' && image == null) ||
        (mediaType == 'text' &&
            (image != null || normalizedMediaUrls.isNotEmpty))) {
      throw const FormatException('Choose media that matches the post type.');
    }
    if (content.isEmpty && image == null && normalizedMediaUrls.isEmpty) {
      throw const FormatException('Write something or add media.');
    }
    if (postKind != 'post' && postKind != 'opportunity') {
      throw const FormatException('Choose a valid post type.');
    }
    if (postKind == 'opportunity' &&
        ((title?.trim().length ?? 0) < 3 ||
            (title?.trim().length ?? 0) > 120 ||
            (role?.trim().length ?? 0) < 2 ||
            (role?.trim().length ?? 0) > 100 ||
            !{
              'cofounder',
              'collaborator',
              'feedback',
              'client',
              'other',
            }.contains(opportunityKind) ||
            !{'remote', 'hybrid', 'in_person', 'flexible'}.contains(workMode) ||
            !{
              'flexible',
              'project',
              'part_time',
              'full_time',
            }.contains(commitment) ||
            skills.any((skill) => skill.trim().length > 50) ||
            location.trim().length > 120 ||
            compensation.trim().length > 160 ||
            ((workMode == 'hybrid' || workMode == 'in_person') &&
                location.trim().length < 2))) {
      throw const FormatException(
        'Add a valid opportunity type, title, and role; in-person roles also need a location.',
      );
    }
    String? uploadedPath;
    if (image != null) {
      final file = File(image.path);
      final length = await file.length();
      if (length == 0 || length > 5 * 1024 * 1024) {
        throw const FormatException('Images must be smaller than 5 MB.');
      }
      final extension = image.name.toLowerCase().split('.').last;
      final mime = switch (extension) {
        'jpg' || 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        _ => throw const FormatException('Choose a JPEG, PNG, or WebP image.'),
      };
      final path =
          '$uid/posts/${DateTime.now().microsecondsSinceEpoch}_${Random.secure().nextInt(1 << 32)}.$extension';
      await client.storage
          .from('avatars')
          .upload(
            path,
            file,
            fileOptions: FileOptions(
              cacheControl: '31536000',
              contentType: mime,
            ),
          );
      uploadedPath = path;
    }

    final normalizedTags = tags
        .map((tag) => tag.trim().replaceFirst(RegExp(r'^#'), ''))
        .where((tag) => tag.isNotEmpty)
        .take(8)
        .map((tag) => '#$tag')
        .toList();
    final payload = <String, dynamic>{
      'author_id': uid,
      'body': content,
      'tags': normalizedTags,
      'media_urls': [
        if (image != null)
          client.storage.from('avatars').getPublicUrl(uploadedPath!),
        ...normalizedMediaUrls,
      ],
      'media_type': image != null ? 'image' : mediaType,
      'post_kind': postKind,
      'opportunity_kind': postKind == 'opportunity' ? opportunityKind : null,
      'opportunity_title': postKind == 'opportunity' ? title?.trim() : null,
      'opportunity_role': postKind == 'opportunity' ? role?.trim() : null,
      'opportunity_skills': postKind == 'opportunity'
          ? skills.take(8).toList()
          : <String>[],
      'opportunity_commitment': postKind == 'opportunity' ? commitment : null,
      'opportunity_work_mode': postKind == 'opportunity' ? workMode : null,
      'opportunity_location': postKind == 'opportunity'
          ? location.trim()
          : null,
      'opportunity_compensation': postKind == 'opportunity'
          ? compensation.trim()
          : null,
      'opportunity_status': postKind == 'opportunity' ? 'open' : null,
    };
    try {
      await client.from('posts').insert(payload);
    } catch (error) {
      if (uploadedPath != null) {
        try {
          await client.storage.from('avatars').remove([uploadedPath]);
        } catch (cleanupError) {
          throw StateError(
            'Post could not be saved ($error), and uploaded media cleanup failed ($cleanupError).',
          );
        }
      }
      rethrow;
    }
  }

  Future<void> setLiked(SocialPost post, bool liked) async {
    final uid = userId;
    if (liked) {
      await client
          .from('likes')
          .upsert(
            {'post_id': post.id, 'user_id': uid},
            onConflict: 'post_id,user_id',
            ignoreDuplicates: true,
          );
    } else {
      await client
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', uid);
    }
  }

  Future<void> setReposted(
    SocialPost post,
    bool reposted, {
    String thoughts = '',
  }) async {
    final uid = userId;
    if (reposted) {
      await client
          .from('reposts')
          .upsert(
            {'post_id': post.id, 'user_id': uid, 'thoughts': thoughts.trim()},
            onConflict: 'post_id,user_id',
            ignoreDuplicates: true,
          );
    } else {
      await client
          .from('reposts')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', uid);
    }
  }

  Future<void> softDeletePost(String postId) async {
    await client
        .from('posts')
        .update({'deleted_at': DateTime.now().toUtc().toIso8601String()})
        .eq('id', postId)
        .eq('author_id', userId);
  }

  Future<void> hidePost(String postId) async {
    try {
      await client.from('hidden_posts').insert({
        'user_id': userId,
        'post_id': postId,
      });
    } on PostgrestException catch (error) {
      if (error.code != '23505') rethrow;
    }
  }

  Future<void> reportPost(String postId) async {
    try {
      await client.from('post_reports').insert({
        'post_id': postId,
        'reporter_id': userId,
      });
    } on PostgrestException catch (error) {
      if (error.code != '23505') rethrow;
    }
  }

  Future<List<SocialComment>> loadComments(String postId) async {
    final uid = client.auth.currentUser?.id ?? '';
    final rows = await client
        .from('comments')
        .select(
          'id,post_id,author_id,parent_comment_id,body,created_at,author:profiles!comments_author_id_fkey(display_name,handle)',
        )
        .eq('post_id', postId)
        .order('created_at', ascending: true)
        .limit(100);
    return rows.map((row) => SocialComment.fromRow(row, uid)).toList();
  }

  Future<SocialComment> addComment(
    String postId,
    String body, {
    String? parentId,
  }) async {
    final text = body.trim();
    if (text.isEmpty || text.length > 1000) {
      throw const FormatException(
        'Comment must be between 1 and 1,000 characters.',
      );
    }
    final row = await client
        .from('comments')
        .insert({
          'post_id': postId,
          'author_id': userId,
          'body': text,
          'parent_comment_id': parentId,
        })
        .select(
          'id,post_id,author_id,parent_comment_id,body,created_at,author:profiles!comments_author_id_fkey(display_name,handle)',
        )
        .single();
    return SocialComment.fromRow(row, userId);
  }

  Future<void> deleteComment(SocialComment comment) async {
    if (!comment.isMine) {
      throw const AuthException('You can only delete your own comments.');
    }
    await client
        .from('comments')
        .delete()
        .eq('id', comment.id)
        .eq('author_id', userId);
  }

  Future<Creator> loadProfile({String? profileId, String? handle}) async {
    var query = client
        .from('profiles')
        .select(
          'id,display_name,handle,role,bio,avatar_url,is_verified,followers_count,following_count,pronouns,backstory,location,age,height,skills,interests,created_at',
        );
    final target = profileId ?? userId;
    final row =
        await (handle == null
                ? query.eq('id', target)
                : query.eq('handle', handle))
            .maybeSingle();
    if (row == null) {
      throw const PostgrestException(message: 'Creator profile not found.');
    }
    final profile = Map<String, dynamic>.from(row);
    final currentUser = client.auth.currentUser;
    if (profile['avatar_url'] == null && currentUser?.id == profile['id']) {
      profile['avatar_url'] =
          currentUser?.userMetadata?['avatar_url'] ??
          currentUser?.userMetadata?['picture'];
    }
    return Creator.fromRow(profile);
  }

  Future<List<SocialPost>> loadProfilePosts(String profileId) async {
    final results = await Future.wait([
      client
          .from('posts')
          .select(postSelect)
          .eq('author_id', profileId)
          .isFilter('deleted_at', null)
          .order('created_at', ascending: false)
          .limit(30),
      client
          .from('reposts')
          .select('post_id,thoughts,created_at')
          .eq('user_id', profileId)
          .order('created_at', ascending: false)
          .limit(30),
    ]);
    final posts = await _mapPosts(results[0], client.auth.currentUser?.id);
    final repostRows = results[1];
    final repostIds = repostRows
        .map((row) => stringValue(row['post_id']))
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();
    if (repostIds.isEmpty) return posts;
    final repostPosts = await _mapPosts(
      await client
          .from('posts')
          .select(postSelect)
          .inFilter('id', repostIds)
          .isFilter('deleted_at', null),
      client.auth.currentUser?.id,
    );
    final postsById = {for (final post in repostPosts) post.id: post};
    final profile = await client
        .from('profiles')
        .select('display_name,handle')
        .eq('id', profileId)
        .maybeSingle();
    final repostName = stringValue(profile?['display_name'], 'Creator');
    final repostHandle = stringValue(profile?['handle'], '@creator');
    final reposts = <SocialPost>[];
    for (final row in repostRows) {
      final post = postsById[stringValue(row['post_id'])];
      if (post == null) continue;
      reposts.add(
        post.copyWith(
          createdAt: stringValue(row['created_at'], post.createdAt),
          repostInfo: SocialRepostInfo(
            name: repostName,
            handle: repostHandle,
            thoughts: stringValue(row['thoughts']),
          ),
        ),
      );
    }
    return ([
      ...posts,
      ...reposts,
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt))).take(30).toList();
  }

  Future<List<JsonMap>> loadProjects(String profileId) async => await client
      .from('shipped_projects')
      .select('id,title,description,link,badge,created_at')
      .eq('owner_id', profileId)
      .order('created_at', ascending: false);

  Future<JsonMap> addProject({
    required String title,
    required String description,
    required String link,
    required String badge,
  }) async {
    final normalizedLink = link.trim();
    if (title.trim().isEmpty ||
        title.trim().length > 120 ||
        description.trim().length > 1000 ||
        badge.trim().length > 80 ||
        (normalizedLink.isNotEmpty &&
            !RegExp(
              r'^https://',
              caseSensitive: false,
            ).hasMatch(normalizedLink))) {
      throw const FormatException(
        'Check the title, description, and HTTPS URL.',
      );
    }
    return await client
        .from('shipped_projects')
        .insert({
          'owner_id': userId,
          'title': title.trim(),
          'description': description.trim(),
          'link': normalizedLink.isEmpty ? null : normalizedLink,
          'badge': badge.trim().isEmpty ? 'SHIPPED PROJECT' : badge.trim(),
        })
        .select('id,title,description,link,badge,created_at')
        .single();
  }

  Future<void> deleteProject(String projectId) async {
    await client
        .from('shipped_projects')
        .delete()
        .eq('id', projectId)
        .eq('owner_id', userId);
  }

  Future<void> updateProfile({
    required String name,
    required String handle,
    required String role,
    required String bio,
    required String location,
    required String pronouns,
    required String backstory,
    required int? age,
    required String height,
    required List<String> skills,
    required List<String> interests,
    String? avatarUrl,
  }) async {
    final normalizedName = name.trim();
    final normalizedHandle = handle
        .trim()
        .replaceFirst(RegExp(r'^@+'), '')
        .toLowerCase();
    if (normalizedName.isEmpty || normalizedName.length > 80) {
      throw const FormatException(
        'Name must contain between 1 and 80 characters.',
      );
    }
    if (!RegExp(r'^[a-z0-9._-]{2,39}$').hasMatch(normalizedHandle)) {
      throw const FormatException(
        'Use 2-39 letters, numbers, periods, underscores, or hyphens for your handle.',
      );
    }
    if (age != null && (age < 13 || age > 120)) {
      throw const FormatException('Age must be between 13 and 120.');
    }
    final normalizedAvatarUrl = avatarUrl?.trim() ?? '';
    if (normalizedAvatarUrl.isNotEmpty &&
        (Uri.tryParse(normalizedAvatarUrl)?.scheme != 'https' ||
            Uri.tryParse(normalizedAvatarUrl)?.host.isEmpty != false)) {
      throw const FormatException('Avatar URL must start with https://.');
    }
    try {
      final updated = await client
          .from('profiles')
          .update({
            'display_name': normalizedName,
            'handle': '@$normalizedHandle',
            'role': _limit(role, 80),
            'bio': _limit(bio, 500),
            'location': _limit(location, 120),
            'pronouns': _limit(pronouns, 40),
            'backstory': _limit(backstory, 1500),
            'age': age,
            'height': _limit(height, 24),
            'avatar_url': normalizedAvatarUrl.isEmpty
                ? null
                : normalizedAvatarUrl,
            'skills': skills
                .map((value) => value.trim())
                .where((value) => value.isNotEmpty)
                .take(20)
                .toList(),
            'interests': interests
                .map((value) => value.trim())
                .where((value) => value.isNotEmpty)
                .take(20)
                .toList(),
          })
          .eq('id', userId)
          .select('id')
          .maybeSingle();
      if (updated == null) {
        throw const PostgrestException(
          message: 'Your profile could not be updated.',
        );
      }
    } on PostgrestException catch (error) {
      if (error.code == '23505') {
        throw const FormatException('That username is already taken.');
      }
      rethrow;
    }
  }

  Future<void> updateAvatar(XFile image) async {
    final uid = userId;
    final file = File(image.path);
    final length = await file.length();
    if (length == 0 || length > 5 * 1024 * 1024) {
      throw const FormatException('Profile photos must be smaller than 5 MB.');
    }
    final extension = image.name.toLowerCase().split('.').last;
    final mime = switch (extension) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => throw const FormatException('Choose a JPEG, PNG, or WebP image.'),
    };
    final bucket = client.storage.from('avatars');
    final current = await client
        .from('profiles')
        .select('avatar_url')
        .eq('id', uid)
        .maybeSingle();
    if (current == null) {
      throw const PostgrestException(
        message: 'Your profile could not be found.',
      );
    }
    final oldUrl = stringValue(current['avatar_url']);
    final path =
        '$uid/${DateTime.now().microsecondsSinceEpoch}_${Random.secure().nextInt(1 << 32)}.$extension';
    await bucket.upload(
      path,
      file,
      fileOptions: FileOptions(cacheControl: '31536000', contentType: mime),
    );
    final url = bucket.getPublicUrl(path);
    try {
      final updated = await client
          .from('profiles')
          .update({'avatar_url': url})
          .eq('id', uid)
          .select('id')
          .maybeSingle();
      if (updated == null) {
        throw const PostgrestException(
          message: 'Your profile photo could not be saved.',
        );
      }
    } catch (error) {
      try {
        await bucket.remove([path]);
      } catch (cleanupError) {
        throw StateError(
          'Profile photo could not be saved ($error), and uploaded photo cleanup failed ($cleanupError).',
        );
      }
      rethrow;
    }
    final previousPath = _ownedAvatarPath(oldUrl, uid);
    if (previousPath != null && previousPath != path) {
      try {
        await bucket.remove([previousPath]);
      } catch (_) {
        throw StateError(
          'Profile photo updated, but the previous photo could not be removed.',
        );
      }
    }
  }

  String? _ownedAvatarPath(String url, String userId) {
    final uri = Uri.tryParse(url);
    final avatarOrigin = Uri.parse(
      client.storage.from('avatars').getPublicUrl(''),
    ).origin;
    if (uri == null || uri.origin != avatarOrigin) {
      return null;
    }
    final bucketMarker = '/storage/v1/object/public/avatars/';
    final markerIndex = uri.path.indexOf(bucketMarker);
    if (markerIndex < 0) return null;
    late final String path;
    try {
      path = Uri.decodeComponent(
        uri.path.substring(markerIndex + bucketMarker.length),
      );
    } on FormatException {
      return null;
    }
    return path.startsWith('$userId/') ? path : null;
  }

  Future<void> setFollowing(String profileId, bool follow) async {
    final uid = userId;
    if (uid == profileId) {
      throw const FormatException('You cannot follow yourself.');
    }
    if (follow) {
      await client
          .from('follows')
          .upsert(
            {'follower_id': uid, 'following_id': profileId},
            onConflict: 'follower_id,following_id',
            ignoreDuplicates: true,
          );
    } else {
      await client
          .from('follows')
          .delete()
          .eq('follower_id', uid)
          .eq('following_id', profileId);
    }
  }

  Future<bool> isFollowing(String profileId) async {
    final row = await client
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .eq('following_id', profileId)
        .maybeSingle();
    return row != null;
  }

  Future<SocialConnectionPage> loadConnections({
    required String profileId,
    required String type,
    String? beforeCreatedAt,
    String? beforeId,
    int pageSize = 20,
  }) async {
    if (type != 'followers' && type != 'following') {
      throw const FormatException('Choose followers or following.');
    }
    if (pageSize < 1 || pageSize > 50) {
      throw const FormatException(
        'Connection page size must be between 1 and 50.',
      );
    }
    if ((beforeCreatedAt == null) != (beforeId == null) ||
        (beforeCreatedAt != null &&
            DateTime.tryParse(beforeCreatedAt) == null)) {
      throw const FormatException('Invalid connections cursor.');
    }

    final personRelation = type == 'followers'
        ? 'person:profiles!follows_follower_id_fkey'
        : 'person:profiles!follows_following_id_fkey';
    var query = client
        .from('follows')
        .select(
          'id,created_at,$personRelation(id,display_name,handle,role,bio,avatar_url,is_verified,followers_count,following_count)',
        )
        .eq(type == 'followers' ? 'following_id' : 'follower_id', profileId);
    if (beforeCreatedAt != null && beforeId != null) {
      query = query.or(
        'created_at.lt.$beforeCreatedAt,and(created_at.eq.$beforeCreatedAt,id.lt.$beforeId)',
      );
    }
    final rows = await query
        .order('created_at', ascending: false)
        .order('id', ascending: false)
        .limit(pageSize + 1);
    final hasMore = rows.length > pageSize;
    final pageRows = rows.take(pageSize).toList();
    final creatorRows = pageRows
        .map((row) => rowValue(row['person']))
        .where((row) => row['id'] != null)
        .toList();
    final ids = creatorRows.map((row) => stringValue(row['id'])).toList();
    final followedIds = ids.isEmpty
        ? <String>{}
        : (await client
                  .from('follows')
                  .select('following_id')
                  .eq('follower_id', userId)
                  .inFilter('following_id', ids))
              .map((row) => stringValue(row['following_id']))
              .toSet();
    final currentUserId = userId;
    final lastRow = pageRows.isEmpty ? null : pageRows.last;

    return SocialConnectionPage(
      people: creatorRows
          .map(
            (row) => SocialConnection(
              creator: Creator.fromRow(row),
              isFollowing: followedIds.contains(stringValue(row['id'])),
              isCurrentUser: row['id'] == currentUserId,
            ),
          )
          .toList(),
      hasMore: hasMore,
      cursorCreatedAt: hasMore ? stringValue(lastRow?['created_at']) : null,
      cursorId: hasMore ? stringValue(lastRow?['id']) : null,
    );
  }

  Future<List<Creator>> searchCreators(String query) async {
    final term = query.trim().replaceAll(
      RegExp(r'[^\p{L}\p{N}_@.\-\s]', unicode: true),
      ' ',
    );
    if (term.length < 2) return [];
    final rows = await client
        .from('profiles')
        .select(
          'id,display_name,handle,role,bio,avatar_url,is_verified,followers_count',
        )
        .or('display_name.ilike.%$term%,handle.ilike.%$term%')
        .order('followers_count', ascending: false)
        .limit(20);
    return rows.map((row) => Creator.fromRow(row)).toList();
  }

  Future<List<CreatorRecommendation>> loadRecommendedCreators() async {
    final uid = userId;
    final profile = await client
        .from('profiles')
        .select('skills,interests')
        .eq('id', uid)
        .maybeSingle();
    if (profile == null) {
      throw const PostgrestException(
        message: 'Your creator profile could not be found.',
      );
    }
    final ownSkills = stringList(profile['skills']);
    final ownInterests = stringList(profile['interests']);
    if (ownSkills.isEmpty && ownInterests.isEmpty) return [];

    final results = await Future.wait([
      client
          .from('profiles')
          .select(
            'id,display_name,handle,role,bio,avatar_url,is_verified,followers_count,skills,interests',
          )
          .neq('id', uid)
          .order('created_at', ascending: false)
          .limit(200),
      client.from('follows').select('following_id').eq('follower_id', uid),
      client.from('user_blocks').select('blocked_id').eq('blocker_id', uid),
    ]);
    final following = results[1]
        .map((row) => stringValue(row['following_id']))
        .toSet();
    final blocked = results[2]
        .map((row) => stringValue(row['blocked_id']))
        .toSet();
    final recommendations = <CreatorRecommendation>[];
    for (final row in results[0]) {
      final id = stringValue(row['id']);
      if (following.contains(id) || blocked.contains(id)) continue;
      final skills = stringList(row['skills']);
      final interests = stringList(row['interests']);
      final sharedInterests = _matchingTerms(ownInterests, interests);
      final sharedSkills = _matchingTerms(ownSkills, skills);
      final skillsYouWant = _matchingTerms(ownInterests, skills);
      final interestsInYourSkills = _matchingTerms(ownSkills, interests);
      final score =
          sharedInterests.length * 4 +
          sharedSkills.length * 3 +
          skillsYouWant.length * 2 +
          interestsInYourSkills.length;
      if (score == 0) continue;
      final reasons = [
        if (sharedInterests.isNotEmpty)
          'Shared interests: ${sharedInterests.join(', ')}',
        if (sharedSkills.isNotEmpty)
          'Shared skills: ${sharedSkills.join(', ')}',
        if (skillsYouWant.isNotEmpty)
          'Skills you are looking for: ${skillsYouWant.join(', ')}',
        if (interestsInYourSkills.isNotEmpty)
          'Interested in your skills: ${interestsInYourSkills.join(', ')}',
      ];
      recommendations.add(
        CreatorRecommendation(
          creator: Creator.fromRow(row),
          reasons: reasons,
          score: score,
        ),
      );
    }
    recommendations.sort((a, b) => b.score.compareTo(a.score));
    return recommendations.take(12).toList();
  }

  List<String> _matchingTerms(List<String> left, List<String> right) {
    final rightTerms = right.map((term) => term.trim().toLowerCase()).toSet();
    return left
        .where((term) => rightTerms.contains(term.trim().toLowerCase()))
        .toList();
  }

  Future<void> applyToOpportunity(String postId, String introduction) async {
    final text = introduction.trim();
    if (text.length < 10 || text.length > 800) {
      throw const FormatException(
        'Write an introduction between 10 and 800 characters.',
      );
    }
    await client.from('collab_interests').insert({
      'post_id': postId,
      'applicant_id': userId,
      'introduction': text,
    });
  }

  Future<void> respondToInterest(String interestId, String status) async {
    if (status != 'accepted' && status != 'declined') {
      throw const FormatException('Choose accepted or declined.');
    }
    final updated = await client
        .from('collab_interests')
        .update({
          'status': status,
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', interestId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
    if (updated == null) {
      throw const PostgrestException(
        message: 'This response has already been reviewed.',
      );
    }
  }

  Future<void> updateOpportunityStatus(String postId, String status) async {
    if (!{'open', 'paused', 'filled'}.contains(status)) {
      throw const FormatException('Choose a valid opportunity status.');
    }
    await client
        .from('posts')
        .update({'opportunity_status': status})
        .eq('id', postId)
        .eq('author_id', userId);
  }

  Future<List<JsonMap>> loadMyInterests() async {
    final interests = await client
        .from('collab_interests')
        .select('id,post_id,introduction,status,created_at')
        .eq('applicant_id', userId)
        .order('created_at', ascending: false);
    if (interests.isEmpty) return [];
    final posts = await client
        .from('posts')
        .select('id,body,opportunity_title,opportunity_role,opportunity_status')
        .inFilter('id', interests.map((row) => row['post_id']).toList());
    final byId = {for (final post in posts) stringValue(post['id']): post};
    return interests
        .map((item) => {...item, 'opportunity': byId[item['post_id']]})
        .toList();
  }

  Future<List<JsonMap>> loadMyOpportunities() async {
    final posts = await client
        .from('posts')
        .select(
          'id,body,opportunity_title,opportunity_role,opportunity_status,created_at',
        )
        .eq('author_id', userId)
        .eq('post_kind', 'opportunity')
        .isFilter('deleted_at', null)
        .order('created_at', ascending: false)
        .limit(100);
    if (posts.isEmpty) return [];
    final interests = await client
        .from('collab_interests')
        .select(
          'id,post_id,applicant_id,introduction,status,created_at,applicant:profiles!collab_interests_applicant_id_fkey(display_name,handle,role,avatar_url)',
        )
        .inFilter('post_id', posts.map((row) => row['id']).toList())
        .order('created_at', ascending: false);
    final byPost = <String, List<JsonMap>>{};
    for (final item in interests) {
      byPost.putIfAbsent(stringValue(item['post_id']), () => []).add(item);
    }
    return posts
        .map(
          (post) => {...post, 'interests': byPost[post['id']] ?? <JsonMap>[]},
        )
        .toList();
  }

  Future<List<SocialConversation>> loadConversations() async {
    final uid = userId;
    final conversations = await client
        .from('conversations')
        .select('id,participant_one,participant_two,created_at')
        .or('participant_one.eq.$uid,participant_two.eq.$uid');
    if (conversations.isEmpty) return [];
    final ids = conversations.map((item) => stringValue(item['id'])).toList();
    final readRows = await client
        .from('conversation_reads')
        .select('conversation_id,last_read_at')
        .eq('user_id', uid)
        .inFilter('conversation_id', ids);
    final readAt = {
      for (final row in readRows)
        stringValue(row['conversation_id']): stringValue(row['last_read_at']),
    };
    final peerIds = conversations
        .map(
          (row) => row['participant_one'] == uid
              ? stringValue(row['participant_two'])
              : stringValue(row['participant_one']),
        )
        .toSet()
        .toList();
    final profiles = await client
        .from('profiles')
        .select(
          'id,display_name,handle,role,bio,avatar_url,is_verified,followers_count',
        )
        .inFilter('id', peerIds);
    final profileById = {
      for (final row in profiles) stringValue(row['id']): row,
    };
    final messages = await client
        .from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .inFilter('conversation_id', ids)
        .order('created_at', ascending: false)
        .limit(500);
    final latest = <String, JsonMap>{};
    for (final row in messages) {
      latest.putIfAbsent(stringValue(row['conversation_id']), () => row);
    }
    final result = <SocialConversation>[];
    for (final conversation in conversations) {
      final id = stringValue(conversation['id']);
      final peerId = conversation['participant_one'] == uid
          ? stringValue(conversation['participant_two'])
          : stringValue(conversation['participant_one']);
      final profile = profileById[peerId];
      if (profile == null) continue;
      final message = latest[id];
      final lastRead = readAt[id];
      final unread =
          message != null &&
          message['sender_id'] == peerId &&
          (lastRead == null ||
              stringValue(message['created_at']).compareTo(lastRead) > 0);
      result.add(
        SocialConversation(
          id: id,
          participant: Creator.fromRow(profile),
          preview: stringValue(message?['body']),
          updatedAt: stringValue(
            message?['created_at'],
            stringValue(conversation['created_at']),
          ),
          unread: unread,
        ),
      );
    }
    result.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return result;
  }

  Future<String> startConversation(String profileId) async {
    final uid = userId;
    if (uid == profileId) {
      throw const FormatException('You cannot message yourself.');
    }
    final sorted = [uid, profileId]..sort();
    final existing = await client
        .from('conversations')
        .select('id')
        .eq('participant_one', sorted.first)
        .eq('participant_two', sorted.last)
        .maybeSingle();
    if (existing != null) return stringValue(existing['id']);
    final created = await client
        .from('conversations')
        .insert({
          'participant_one': sorted.first,
          'participant_two': sorted.last,
        })
        .select('id')
        .single();
    return stringValue(created['id']);
  }

  Future<List<JsonMap>> loadMessages(String conversationId) async {
    final rows = await client
        .from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .limit(200);
    await markConversationRead(conversationId);
    return rows;
  }

  Future<JsonMap> sendMessage(String conversationId, String body) async {
    final text = body.trim();
    if (text.isEmpty || text.length > 4000) {
      throw const FormatException('Write a message under 4,000 characters.');
    }
    final message = await client
        .from('messages')
        .insert({
          'conversation_id': conversationId,
          'sender_id': userId,
          'body': text,
        })
        .select('id,conversation_id,sender_id,body,created_at')
        .single();
    return Map<String, dynamic>.from(message);
  }

  Future<void> markConversationRead(String conversationId) async {
    final uid = userId;
    final existing = await client
        .from('conversation_reads')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', uid)
        .maybeSingle();
    final now = DateTime.now().toUtc().toIso8601String();
    if (existing == null) {
      await client.from('conversation_reads').insert({
        'conversation_id': conversationId,
        'user_id': uid,
        'last_read_at': now,
      });
    } else {
      await client
          .from('conversation_reads')
          .update({'last_read_at': now})
          .eq('conversation_id', conversationId)
          .eq('user_id', uid);
    }
  }

  Future<SocialNotificationPage> loadNotificationPage({
    String? beforeCreatedAt,
    String? beforeId,
    int pageSize = 20,
  }) async {
    if (pageSize < 1 || pageSize > 50) {
      throw const FormatException(
        'Notification page size must be between 1 and 50.',
      );
    }
    if ((beforeCreatedAt == null) != (beforeId == null) ||
        (beforeCreatedAt != null &&
            DateTime.tryParse(beforeCreatedAt) == null)) {
      throw const FormatException('Invalid notification cursor.');
    }
    var query = client
        .from('notifications')
        .select(
          'id,actor_id,notification_type,post_id,conversation_id,created_at,read_at,actor:profiles!notifications_actor_id_fkey(display_name,handle,avatar_url),post:posts!notifications_post_id_fkey(body)',
        )
        .eq('recipient_id', userId);
    if (beforeCreatedAt != null && beforeId != null) {
      query = query.or(
        'created_at.lt.$beforeCreatedAt,and(created_at.eq.$beforeCreatedAt,id.lt.$beforeId)',
      );
    }
    final rows = await query
        .order('created_at', ascending: false)
        .order('id', ascending: false)
        .limit(pageSize + 1);
    final hasMore = rows.length > pageSize;
    final pageRows = rows.take(pageSize).toList();
    final lastRow = pageRows.isEmpty ? null : pageRows.last;
    return SocialNotificationPage(
      notifications: pageRows
          .map((row) => Map<String, dynamic>.from(row))
          .toList(),
      hasMore: hasMore,
      cursorCreatedAt: hasMore ? stringValue(lastRow?['created_at']) : null,
      cursorId: hasMore ? stringValue(lastRow?['id']) : null,
    );
  }

  Future<List<JsonMap>> loadNotifications() async =>
      (await loadNotificationPage(pageSize: 50)).notifications;

  Future<void> markNotificationRead(String id) async {
    await client
        .from('notifications')
        .update({'read_at': DateTime.now().toUtc().toIso8601String()})
        .eq('id', id)
        .eq('recipient_id', userId);
  }

  Future<void> markAllNotificationsRead() async {
    await client
        .from('notifications')
        .update({'read_at': DateTime.now().toUtc().toIso8601String()})
        .eq('recipient_id', userId)
        .isFilter('read_at', null);
  }

  Future<List<JsonMap>> loadBlockedUsers() async {
    final blocked = await client
        .from('user_blocks')
        .select('blocked_id,created_at')
        .eq('blocker_id', userId);
    if (blocked.isEmpty) return [];
    final profiles = await client
        .from('profiles')
        .select('id,display_name,handle,role,bio,avatar_url,is_verified')
        .inFilter('id', blocked.map((row) => row['blocked_id']).toList());
    return profiles;
  }

  Future<void> unblockUser(String profileId) async {
    await client
        .from('user_blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', profileId);
  }

  Future<void> blockUser(String profileId) async {
    if (profileId == userId) {
      throw const FormatException('You cannot block yourself.');
    }
    try {
      await client.from('user_blocks').insert({
        'blocker_id': userId,
        'blocked_id': profileId,
      });
    } on PostgrestException catch (error) {
      if (error.code != '23505') rethrow;
    }
  }

  Future<(int notifications, int conversations)> loadUnreadCounts() async {
    final unreadNotifications = await client
        .from('notifications')
        .select('id')
        .eq('recipient_id', userId)
        .isFilter('read_at', null)
        .limit(200);
    final conversations = await loadConversations();
    return (
      unreadNotifications.length,
      conversations.where((conversation) => conversation.unread).length,
    );
  }

  String _limit(String value, int maxLength) {
    final normalized = value.trim();
    return normalized.length <= maxLength
        ? normalized
        : normalized.substring(0, maxLength);
  }
}
