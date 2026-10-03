import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../data/repository.dart';
import '../widgets.dart';

class CreateScreen extends StatefulWidget {
  const CreateScreen({
    super.key,
    required this.repository,
    required this.onPosted,
    this.initialKind = 'post',
  });
  final AppRepository repository;
  final VoidCallback onPosted;
  final String initialKind;

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> {
  final _body = TextEditingController();
  final _tags = TextEditingController();
  final _title = TextEditingController();
  final _role = TextEditingController();
  final _skills = TextEditingController();
  final _location = TextEditingController();
  final _compensation = TextEditingController();
  final _mediaUrls = TextEditingController();
  final _picker = ImagePicker();
  late String _kind = widget.initialKind;
  String _opportunityType = '';
  String _commitment = 'flexible';
  String _workMode = 'flexible';
  String _mediaType = 'text';
  XFile? _image;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _body.dispose();
    _tags.dispose();
    _title.dispose();
    _role.dispose();
    _skills.dispose();
    _location.dispose();
    _compensation.dispose();
    _mediaUrls.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final image = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 86,
        maxWidth: 2200,
      );
      if (image != null && mounted) {
        setState(() {
          _mediaType = 'image';
          _image = image;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not open your photo library.');
      }
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.repository.createPost(
        body: _body.text,
        tags: _tags.text.split(RegExp(r'[, ]+')),
        image: _image,
        mediaType: _mediaType,
        mediaUrls: _mediaUrls.text
            .split(RegExp(r'\s+'))
            .map((url) => url.trim())
            .where((url) => url.isNotEmpty)
            .toList(),
        postKind: _kind,
        opportunityKind: _kind == 'opportunity' ? _opportunityType : null,
        title: _title.text,
        role: _role.text,
        skills: _skills.text
            .split(RegExp(r'[,]+'))
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList(),
        commitment: _commitment,
        workMode: _workMode,
        location: _location.text,
        compensation: _compensation.text,
      );
      if (!mounted) return;
      widget.onPosted();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Posted successfully.')));
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error is FormatException
              ? error.message
              : 'Could not publish. Check your connection and try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    child: ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 30),
      children: [
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(
              value: 'post',
              label: Text('Post'),
              icon: Icon(Icons.edit_outlined),
            ),
            ButtonSegment(
              value: 'opportunity',
              label: Text('Opportunity'),
              icon: Icon(Icons.handshake_outlined),
            ),
          ],
          selected: {_kind},
          onSelectionChanged: (value) => setState(() {
            _kind = value.first;
            _error = null;
          }),
        ),
        const SizedBox(height: 18),
        if (_kind == 'opportunity') ...[
          Text(
            'Find people to build with',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Opportunity title'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _role,
            decoration: const InputDecoration(
              labelText: 'Role or what you need',
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _opportunityType,
            decoration: const InputDecoration(labelText: 'Type'),
            items: const [
              DropdownMenuItem(value: '', child: Text('Choose one')),
              DropdownMenuItem(
                value: 'collaborator',
                child: Text('Collaboration'),
              ),
              DropdownMenuItem(value: 'cofounder', child: Text('Co-founder')),
              DropdownMenuItem(value: 'feedback', child: Text('Feedback')),
              DropdownMenuItem(value: 'client', child: Text('Client work')),
              DropdownMenuItem(value: 'other', child: Text('Other')),
            ],
            onChanged: (value) =>
                setState(() => _opportunityType = value ?? _opportunityType),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _workMode,
            decoration: const InputDecoration(labelText: 'Work mode'),
            items: const [
              DropdownMenuItem(value: 'remote', child: Text('Remote')),
              DropdownMenuItem(value: 'hybrid', child: Text('Hybrid')),
              DropdownMenuItem(value: 'in_person', child: Text('In person')),
              DropdownMenuItem(value: 'flexible', child: Text('Flexible')),
            ],
            onChanged: (value) =>
                setState(() => _workMode = value ?? _workMode),
          ),
          if (_workMode != 'remote') ...[
            const SizedBox(height: 10),
            TextField(
              controller: _location,
              decoration: const InputDecoration(labelText: 'Location'),
            ),
          ],
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _commitment,
            decoration: const InputDecoration(labelText: 'Time commitment'),
            items: const [
              DropdownMenuItem(value: 'flexible', child: Text('Flexible')),
              DropdownMenuItem(value: 'project', child: Text('Per project')),
              DropdownMenuItem(value: 'part_time', child: Text('Part time')),
              DropdownMenuItem(value: 'full_time', child: Text('Full time')),
            ],
            onChanged: (value) =>
                setState(() => _commitment = value ?? _commitment),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _skills,
            decoration: const InputDecoration(
              labelText: 'Skills (comma separated)',
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _compensation,
            decoration: const InputDecoration(
              labelText: 'Compensation (optional)',
            ),
          ),
          const SizedBox(height: 14),
        ],
        TextField(
          controller: _body,
          minLines: 5,
          maxLines: 10,
          maxLength: 1000,
          decoration: InputDecoration(
            labelText: _kind == 'opportunity'
                ? 'Describe the opportunity'
                : 'What are you building?',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _tags,
          decoration: const InputDecoration(
            labelText: 'Tags (comma separated)',
          ),
        ),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(
              value: 'text',
              label: Text('Text'),
              icon: Icon(Icons.notes_outlined),
            ),
            ButtonSegment(
              value: 'image',
              label: Text('Image'),
              icon: Icon(Icons.image_outlined),
            ),
            ButtonSegment(
              value: 'video',
              label: Text('Video'),
              icon: Icon(Icons.videocam_outlined),
            ),
          ],
          selected: {_mediaType},
          onSelectionChanged: _busy
              ? null
              : (selection) {
                  final type = selection.first;
                  if (type == 'image') {
                    setState(() {
                      _mediaType = type;
                      _image = null;
                      _mediaUrls.clear();
                    });
                    _pickImage();
                  } else {
                    setState(() {
                      _mediaType = type;
                      _image = null;
                      if (type == 'text') _mediaUrls.clear();
                    });
                  }
                },
        ),
        if (_mediaType == 'video') ...[
          const SizedBox(height: 10),
          TextField(
            controller: _mediaUrls,
            minLines: 2,
            maxLines: 4,
            keyboardType: TextInputType.url,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Video URLs',
              hintText: 'https://',
              helperText: 'Add up to four HTTPS video URLs, one per line.',
              alignLabelWithHint: true,
            ),
          ),
        ],
        if (_mediaType == 'image' && _image == null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _pickImage,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Choose a photo'),
            ),
          ),
        if (_mediaType == 'image' && _image != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.file(
                File(_image!.path),
                height: 190,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  height: 80,
                  alignment: Alignment.center,
                  color: Colors.white10,
                  child: Text(_image!.name),
                ),
              ),
            ),
          ),
        if (_error != null) InlineNotice(text: _error!, isError: true),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _busy ||
                  (_mediaType == 'image' && _image == null) ||
                  (_mediaType == 'video' && _mediaUrls.text.trim().isEmpty)
              ? null
              : _submit,
          icon: _busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send_rounded),
          label: Text(_busy ? 'Publishing…' : 'Publish'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
        ),
      ],
    ),
  );
}
