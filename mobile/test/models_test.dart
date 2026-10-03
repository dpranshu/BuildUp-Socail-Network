import 'package:buildup_mobile/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
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
      },
    });

    final updated = post.copyWith(likedByMe: true, likes: 3);

    expect(post.author, 'Ada');
    expect(post.handle, '@ada');
    expect(post.authorBio, 'Building useful things');
    expect(updated.likedByMe, isTrue);
    expect(updated.likes, 3);
    expect(updated.body, post.body);
    expect(updated.authorBio, post.authorBio);
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
