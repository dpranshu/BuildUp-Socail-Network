typedef JsonMap = Map<String, dynamic>;

String stringValue(Object? value, [String fallback = '']) =>
    value is String ? value : fallback;

int intValue(Object? value) => value is num ? value.toInt() : 0;

List<String> stringList(Object? value) =>
    value is List ? value.whereType<String>().toList() : <String>[];

JsonMap rowValue(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

class Creator {
  const Creator({
    required this.id,
    required this.name,
    required this.handle,
    this.role = '',
    this.bio = '',
    this.location = '',
    this.pronouns = '',
    this.backstory = '',
    this.age,
    this.height = '',
    this.skills = const [],
    this.interests = const [],
    this.avatarUrl,
    this.verified = false,
    this.followers = 0,
    this.followingCount = 0,
    this.following = false,
  });

  final String id;
  final String name;
  final String handle;
  final String role;
  final String bio;
  final String location;
  final String pronouns;
  final String backstory;
  final int? age;
  final String height;
  final List<String> skills;
  final List<String> interests;
  final String? avatarUrl;
  final bool verified;
  final int followers;
  final int followingCount;
  final bool following;

  factory Creator.fromRow(JsonMap row, {bool following = false}) => Creator(
    id: stringValue(row['id']),
    name: stringValue(row['display_name'], 'Creator'),
    handle: stringValue(row['handle'], '@creator'),
    role: stringValue(row['role']),
    bio: stringValue(row['bio']),
    location: stringValue(row['location']),
    pronouns: stringValue(row['pronouns']),
    backstory: stringValue(row['backstory']),
    age: row['age'] is num ? (row['age'] as num).toInt() : null,
    height: stringValue(row['height']),
    skills: stringList(row['skills']),
    interests: stringList(row['interests']),
    avatarUrl: row['avatar_url'] as String?,
    verified: row['is_verified'] == true,
    followers: intValue(row['followers_count']),
    followingCount: intValue(row['following_count']),
    following: following,
  );
}

class SocialConnection {
  const SocialConnection({
    required this.creator,
    required this.isFollowing,
    required this.isCurrentUser,
  });

  final Creator creator;
  final bool isFollowing;
  final bool isCurrentUser;

  SocialConnection copyWith({bool? isFollowing}) => SocialConnection(
    creator: creator,
    isFollowing: isFollowing ?? this.isFollowing,
    isCurrentUser: isCurrentUser,
  );
}

class SocialConnectionPage {
  const SocialConnectionPage({
    required this.people,
    required this.hasMore,
    this.cursorCreatedAt,
    this.cursorId,
  });

  final List<SocialConnection> people;
  final bool hasMore;
  final String? cursorCreatedAt;
  final String? cursorId;
}

class SocialPost {
  const SocialPost({
    required this.id,
    required this.authorId,
    required this.author,
    required this.handle,
    this.authorBio = '',
    this.authorVerified = false,
    required this.body,
    required this.createdAt,
    this.avatarUrl,
    this.tags = const [],
    this.mediaUrls = const [],
    this.mediaType = 'text',
    this.postKind = 'post',
    this.opportunityKind,
    this.opportunityTitle,
    this.opportunityRole,
    this.opportunitySkills = const [],
    this.opportunityCommitment,
    this.opportunityWorkMode,
    this.opportunityLocation,
    this.opportunityCompensation,
    this.opportunityStatus,
    this.likes = 0,
    this.comments = 0,
    this.reposts = 0,
    this.isMine = false,
    this.likedByMe = false,
    this.repostedByMe = false,
    this.interestStatus,
    this.repostInfo,
  });

  final String id;
  final String authorId;
  final String author;
  final String handle;
  final String authorBio;
  final bool authorVerified;
  final String body;
  final String createdAt;
  final String? avatarUrl;
  final List<String> tags;
  final List<String> mediaUrls;
  final String mediaType;
  final String postKind;
  final String? opportunityKind;
  final String? opportunityTitle;
  final String? opportunityRole;
  final List<String> opportunitySkills;
  final String? opportunityCommitment;
  final String? opportunityWorkMode;
  final String? opportunityLocation;
  final String? opportunityCompensation;
  final String? opportunityStatus;
  final int likes;
  final int comments;
  final int reposts;
  final bool isMine;
  final bool likedByMe;
  final bool repostedByMe;
  final String? interestStatus;
  final SocialRepostInfo? repostInfo;

  factory SocialPost.fromRow(
    JsonMap row, {
    bool isMine = false,
    bool liked = false,
    bool reposted = false,
    String? interestStatus,
  }) {
    final author = rowValue(row['author']);
    return SocialPost(
      id: stringValue(row['id']),
      authorId: stringValue(row['author_id']),
      author: stringValue(author['display_name'], 'Creator'),
      handle: stringValue(author['handle'], '@creator'),
      authorBio: stringValue(author['bio']),
      authorVerified: author['is_verified'] == true,
      avatarUrl: author['avatar_url'] as String?,
      body: stringValue(row['body']),
      createdAt: stringValue(row['created_at']),
      tags: stringList(row['tags']),
      mediaUrls: stringList(row['media_urls']),
      mediaType: stringValue(row['media_type'], 'text'),
      postKind: stringValue(row['post_kind'], 'post'),
      opportunityKind: row['opportunity_kind'] as String?,
      opportunityTitle: row['opportunity_title'] as String?,
      opportunityRole: row['opportunity_role'] as String?,
      opportunitySkills: stringList(row['opportunity_skills']),
      opportunityCommitment: row['opportunity_commitment'] as String?,
      opportunityWorkMode: row['opportunity_work_mode'] as String?,
      opportunityLocation: row['opportunity_location'] as String?,
      opportunityCompensation: row['opportunity_compensation'] as String?,
      opportunityStatus: row['opportunity_status'] as String?,
      likes: intValue(row['likes_count']),
      comments: intValue(row['comments_count']),
      reposts: intValue(row['reposts_count']),
      isMine: isMine,
      likedByMe: liked,
      repostedByMe: reposted,
      interestStatus: interestStatus,
      repostInfo: row['repost_info'] == null
          ? null
          : SocialRepostInfo.fromRow(rowValue(row['repost_info'])),
    );
  }

  SocialPost copyWith({
    int? likes,
    int? comments,
    int? reposts,
    bool? likedByMe,
    bool? repostedByMe,
    String? interestStatus,
    String? opportunityStatus,
    String? createdAt,
    SocialRepostInfo? repostInfo,
  }) => SocialPost(
    id: id,
    authorId: authorId,
    author: author,
    handle: handle,
    authorBio: authorBio,
    authorVerified: authorVerified,
    body: body,
    createdAt: createdAt ?? this.createdAt,
    avatarUrl: avatarUrl,
    tags: tags,
    mediaUrls: mediaUrls,
    mediaType: mediaType,
    postKind: postKind,
    opportunityKind: opportunityKind,
    opportunityTitle: opportunityTitle,
    opportunityRole: opportunityRole,
    opportunitySkills: opportunitySkills,
    opportunityCommitment: opportunityCommitment,
    opportunityWorkMode: opportunityWorkMode,
    opportunityLocation: opportunityLocation,
    opportunityCompensation: opportunityCompensation,
    opportunityStatus: opportunityStatus ?? this.opportunityStatus,
    likes: likes ?? this.likes,
    comments: comments ?? this.comments,
    reposts: reposts ?? this.reposts,
    isMine: isMine,
    likedByMe: likedByMe ?? this.likedByMe,
    repostedByMe: repostedByMe ?? this.repostedByMe,
    interestStatus: interestStatus ?? this.interestStatus,
    repostInfo: repostInfo ?? this.repostInfo,
  );
}

class SocialRepostInfo {
  const SocialRepostInfo({
    required this.name,
    required this.handle,
    required this.thoughts,
  });

  final String name;
  final String handle;
  final String thoughts;

  factory SocialRepostInfo.fromRow(JsonMap row) => SocialRepostInfo(
    name: stringValue(row['name'], 'Creator'),
    handle: stringValue(row['handle'], '@creator'),
    thoughts: stringValue(row['thoughts']),
  );
}

class SocialComment {
  const SocialComment({
    required this.id,
    required this.postId,
    required this.authorId,
    required this.body,
    required this.createdAt,
    this.parentId,
    this.author = 'Creator',
    this.handle = '@creator',
    this.isMine = false,
  });

  final String id;
  final String postId;
  final String authorId;
  final String body;
  final String createdAt;
  final String? parentId;
  final String author;
  final String handle;
  final bool isMine;

  factory SocialComment.fromRow(JsonMap row, String currentUserId) {
    final author = rowValue(row['author']);
    return SocialComment(
      id: stringValue(row['id']),
      postId: stringValue(row['post_id']),
      authorId: stringValue(row['author_id']),
      body: stringValue(row['body']),
      createdAt: stringValue(row['created_at']),
      parentId: row['parent_comment_id'] as String?,
      author: stringValue(author['display_name'], 'Creator'),
      handle: stringValue(author['handle'], '@creator'),
      isMine: row['author_id'] == currentUserId,
    );
  }
}

class SocialConversation {
  const SocialConversation({
    required this.id,
    required this.participant,
    this.preview = '',
    this.updatedAt = '',
    this.unread = false,
  });

  final String id;
  final Creator participant;
  final String preview;
  final String updatedAt;
  final bool unread;
}

class CreatorRecommendation {
  const CreatorRecommendation({
    required this.creator,
    required this.reasons,
    required this.score,
  });

  final Creator creator;
  final List<String> reasons;
  final int score;
}
