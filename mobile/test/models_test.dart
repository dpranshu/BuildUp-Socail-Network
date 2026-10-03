import 'package:buildup_mobile/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps every profile field used by the profile page', () {
    final creator = Creator.fromRow({
      'id': 'creator-1',
      'display_name': 'Ada Lovelace',
      'handle': '@ada',
      'role': 'Engineer',
      'bio': 'Building useful things.',
      'backstory': 'Learning in public.',
      'pronouns': 'they/them',
      'location': 'London',
      'age': 32,
      'height': '170 cm',
      'avatar_url': 'https://example.com/avatar.png',
      'is_verified': true,
      'followers_count': 12,
      'following_count': 9,
      'skills': ['Dart', 'Design'],
      'interests': ['Cycling'],
    });

    expect(creator.id, 'creator-1');
    expect(creator.name, 'Ada Lovelace');
    expect(creator.handle, '@ada');
    expect(creator.role, 'Engineer');
    expect(creator.bio, 'Building useful things.');
    expect(creator.backstory, 'Learning in public.');
    expect(creator.pronouns, 'they/them');
    expect(creator.location, 'London');
    expect(creator.age, 32);
    expect(creator.height, '170 cm');
    expect(creator.avatarUrl, 'https://example.com/avatar.png');
    expect(creator.verified, isTrue);
    expect(creator.followers, 12);
    expect(creator.followingCount, 9);
    expect(creator.skills, ['Dart', 'Design']);
    expect(creator.interests, ['Cycling']);
  });

  test('parses post metadata and preserves optimistic reaction updates', () {
    final post = SocialPost.fromRow({
      'id': 'post-1',
      'author_id': 'creator-1',
      'body': 'Building something',
      'created_at': '2026-04-01T10:00:00Z',
      'tags': ['design'],
      'media_urls': <String>[],
      'likes_count': 2,
      'author': {
        'display_name': 'Ada',
        'handle': '@ada',
        'bio': 'Building useful things',
        'is_verified': true,
      },
    });

    final updated = post.copyWith(likedByMe: true, likes: 3);

    expect(post.author, 'Ada');
    expect(post.handle, '@ada');
    expect(post.authorBio, 'Building useful things');
    expect(post.authorVerified, isTrue);
    expect(updated.likedByMe, isTrue);
    expect(updated.likes, 3);
    expect(updated.body, post.body);
    expect(updated.authorBio, post.authorBio);
  });

  test('parses profile reposts and preserves them in copied posts', () {
    final post = SocialPost.fromRow({
      'id': 'post-1',
      'author_id': 'creator-2',
      'body': 'A useful update',
      'created_at': '2026-04-01T10:00:00Z',
      'author': {'display_name': 'Grace', 'handle': '@grace'},
      'repost_info': {
        'name': 'Ada',
        'handle': '@ada',
        'thoughts': 'Worth sharing.',
      },
    });

    expect(post.repostInfo?.name, 'Ada');
    expect(post.repostInfo?.handle, '@ada');
    expect(post.repostInfo?.thoughts, 'Worth sharing.');
    expect(post.copyWith(likes: 1).repostInfo?.thoughts, 'Worth sharing.');
  });

  test('parses comment parent reference and current-user ownership', () {
    final comment = SocialComment.fromRow({
      'id': 'reply-1',
      'post_id': 'post-1',
      'author_id': 'user-1',
      'parent_comment_id': 'comment-1',
      'body': 'I agree',
      'created_at': '2026-04-01T10:00:00Z',
      'author': {'display_name': 'Ada', 'handle': '@ada'},
    }, 'user-1');

    expect(comment.parentId, 'comment-1');
    expect(comment.isMine, isTrue);
    expect(comment.author, 'Ada');
  });
}
