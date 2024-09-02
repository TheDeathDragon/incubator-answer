/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState, memo } from 'react';
import { Button, Form, Modal, Tab, Tabs } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

import { Modal as AnswerModal } from '@/components';
import ToolItem from '../toolItem';
import { IEditorContext, Editor } from '../types';
import { uploadFile } from '@/services';

let context: IEditorContext;
const Attachment = ({ editorInstance }) => {
  const [editor, setEditor] = useState<Editor>(editorInstance);
  const { t } = useTranslation('translation', { keyPrefix: 'editor' });

  const loadingText = `![${t('attachment.uploading')}...]()`;

  const item = {
    label: 'file-earmark-arrow-up-fill',
    keyMap: ['Ctrl-f'],
    tip: `${t('attachment.text')} (Ctrl+F)`,
  };
  const [currentTab, setCurrentTab] = useState('localFile');
  const [visible, setVisible] = useState(false);
  const [link, setLink] = useState({
    value: '',
    isInvalid: false,
    errorMsg: '',
    type: '',
  });

  const [fileName, setFileName] = useState({
    value: '',
    isInvalid: false,
    errorMsg: '',
  });

  const verifyFileSize = (files: FileList) => {
    if (files.length === 0) {
      return false;
    }

    const filteredFiles = Array.from(files).filter(
      (file) => file.size / 1024 / 1024 > 50,
    );

    if (filteredFiles.length > 0) {
      AnswerModal.confirm({
        content: t('attachment.form_file.fields.file.msg.max_size'),
      });
      return false;
    }
    return true;
  };

  const upload = (
    files: FileList,
  ): Promise<{ url: string; name: string }[]> => {
    const promises = Array.from(files).map(async (file) => {
      const url = await uploadFile({ file, type: 'attachment' });

      return {
        name: file.name,
        url,
      };
    });

    return Promise.all(promises);
  };

  function dragenter(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function dragover(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const drop = async (e) => {
    const fileList = e.dataTransfer.files;

    const bool = verifyFileSize(fileList);

    if (!bool) {
      return;
    }

    const startPos = editor.getCursor();

    const endPos = { ...startPos, ch: startPos.ch + loadingText.length };

    editor.replaceSelection(loadingText);
    editor.setReadOnly(true);
    const urls = await upload(fileList).catch((ex) => {
      console.error('upload file error: ', ex);
    });

    const text: string[] = [];
    if (Array.isArray(urls)) {
      urls.forEach(({ name, url }) => {
        if (name && url) {
          text.push(`[${name}](${url})`);
        }
      });
    }
    if (text.length) {
      editor.replaceRange(text.join('\n'), startPos, endPos);
    } else {
      editor.replaceRange('', startPos, endPos);
    }
    editor.setReadOnly(false);
    editor.focus();
  };

  const paste = async (event) => {
    const clipboard = event.clipboardData;

    const bool = verifyFileSize(clipboard.files);

    if (bool) {
      event.preventDefault();
      const startPos = editor.getCursor();
      const endPos = { ...startPos, ch: startPos.ch + loadingText.length };

      editor.replaceSelection(loadingText);
      editor.setReadOnly(true);
      const urls = await upload(clipboard.files);
      const text = urls.map(({ name, url }) => {
        return `[${name}](${url})`;
      });

      editor.replaceRange(text.join('\n'), startPos, endPos);
      editor.setReadOnly(false);
      editor.focus();
    }
  };

  const handleClick = () => {
    if (!link.value) {
      setLink({ ...link, isInvalid: true });
      return;
    }
    setLink({ ...link, type: '' });

    const text = `[${fileName.value}](${link.value})`;

    editor.replaceSelection(text);

    setVisible(false);

    editor.focus();
    setLink({ ...link, value: '' });
    setFileName({ ...fileName, value: '' });
  };

  useEffect(() => {
    editor?.on('dragenter', dragenter);
    editor?.on('dragover', dragover);
    editor?.on('drop', drop);
    editor?.on('paste', paste);
    return () => {
      editor?.off('dragenter', dragenter);
      editor?.off('dragover', dragover);
      editor?.off('drop', drop);
      editor?.off('paste', paste);
    };
  }, [editor]);

  useEffect(() => {
    if (link.value && link.type === 'drop') {
      handleClick();
    }
  }, [link.value]);

  const addLink = (ctx) => {
    context = ctx;
    setEditor(context.editor);
    const text = context.editor?.getSelection();

    setFileName({ ...fileName, value: text });

    setVisible(true);
  };

  const onUpload = async (e) => {
    if (!editor) {
      return;
    }
    const files = e.target?.files || [];
    const bool = verifyFileSize(files);

    if (!bool) {
      return;
    }

    uploadFile({ file: e.target.files[0], type: 'attachment' }).then((url) => {
      setLink({ ...link, value: url });
    });
  };

  const onHide = () => setVisible(false);
  const onExited = () => editor?.focus();

  const handleSelect = (tab) => {
    setCurrentTab(tab);
  };

  return (
    <ToolItem {...item} onClick={addLink}>
      <Modal
        show={visible}
        onHide={onHide}
        onExited={onExited}
        fullscreen="sm-down">
        <Modal.Header closeButton>
          <h5 className="mb-0">{t('attachment.add_attachment')}</h5>
        </Modal.Header>
        <Modal.Body>
          <Tabs onSelect={handleSelect}>
            <Tab eventKey="localFile" title={t('attachment.tab_file')}>
              <Form className="mt-3" onSubmit={handleClick}>
                <Form.Group controlId="editor.fileLink" className="mb-3">
                  <Form.Label>
                    {t('attachment.form_file.fields.file.label')}
                  </Form.Label>
                  <Form.Control
                    type="file"
                    onChange={onUpload}
                    isInvalid={currentTab === 'localFile' && link.isInvalid}
                  />
                  <Form.Control.Feedback type="invalid">
                    {t('attachment.form_file.fields.file.msg.empty')}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group controlId="editor.fileDescription" className="mb-3">
                  <Form.Label>
                    {`${t('attachment.form_file.fields.desc.label')} ${t(
                      'optional',
                      {
                        keyPrefix: 'form',
                      },
                    )}`}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={fileName.value}
                    onChange={(e) =>
                      setFileName({ ...fileName, value: e.target.value })
                    }
                    isInvalid={fileName.isInvalid}
                  />
                </Form.Group>
              </Form>
            </Tab>
            <Tab eventKey="remoteFile" title={t('attachment.tab_url')}>
              <Form className="mt-3" onSubmit={handleClick}>
                <Form.Group controlId="editor.fileUrl" className="mb-3">
                  <Form.Label>
                    {t('attachment.form_url.fields.url.label')}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={link.value}
                    onChange={(e) =>
                      setLink({ ...link, value: e.target.value })
                    }
                    isInvalid={currentTab === 'remoteFile' && link.isInvalid}
                  />
                  <Form.Control.Feedback type="invalid">
                    {t('attachment.form_url.fields.url.msg.empty')}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group controlId="editor.fileName" className="mb-3">
                  <Form.Label>
                    {`${t('attachment.form_url.fields.name.label')} ${t(
                      'optional',
                      {
                        keyPrefix: 'form',
                      },
                    )}`}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={fileName.value}
                    onChange={(e) =>
                      setFileName({ ...fileName, value: e.target.value })
                    }
                    isInvalid={fileName.isInvalid}
                  />
                </Form.Group>
              </Form>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="link" onClick={() => setVisible(false)}>
            {t('attachment.btn_cancel')}
          </Button>
          <Button variant="primary" onClick={handleClick}>
            {t('attachment.btn_submit')}
          </Button>
        </Modal.Footer>
      </Modal>
    </ToolItem>
  );
};

export default memo(Attachment);
