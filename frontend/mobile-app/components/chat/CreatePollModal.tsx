import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ZaloColors } from '@/constants/zalo';

interface CreatePollModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
  onUpdate?: (question: string, options: string[]) => void;
  initialData?: { question: string; options: any[] };
}

export default function CreatePollModal({ visible, onClose, onCreate, onUpdate, initialData }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  React.useEffect(() => {
    if (initialData) {
      setQuestion(initialData.question);
      setOptions(initialData.options.map(o => o.text));
    } else {
      setQuestion('');
      setOptions(['', '']);
    }
  }, [initialData, visible]);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };
  const handleCreate = () => {
    if (!question.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập câu hỏi');
      return;
    }

    const filteredOptions = options.map(o => o.trim()).filter(o => o !== '');
    if (filteredOptions.length < 2) {
      Alert.alert('Thông báo', 'Vui lòng nhập ít nhất 2 phương án');
      return;
    }

    if (initialData && onUpdate) {
      onUpdate(question.trim(), filteredOptions);
    } else {
      onCreate(question.trim(), filteredOptions);
    }
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>{initialData ? 'Chỉnh sửa bình chọn' : 'Tạo bình chọn'}</Text>
            <TouchableOpacity onPress={handleCreate}>
              <Text style={styles.createBtnText}>{initialData ? 'Lưu' : 'Tạo'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>CÂU HỎI BÌNH CHỌN</Text>
            <TextInput
              style={styles.questionInput}
              placeholder="Nhập câu hỏi..."
              value={question}
              onChangeText={setQuestion}
              multiline
            />

            <Text style={[styles.label, { marginTop: 20 }]}>CÁC PHƯƠNG ÁN</Text>
            {options.map((opt, idx) => (
              <View key={idx} style={styles.optionRow}>
                <View style={styles.optionInputWrap}>
                  <TextInput
                    style={styles.optionInput}
                    placeholder={`Phương án ${idx + 1}`}
                    value={opt}
                    onChangeText={(val) => handleOptionChange(idx, val)}
                  />
                </View>
                {options.length > 2 && (
                  <TouchableOpacity 
                    onPress={() => handleRemoveOption(idx)}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="remove-circle" size={20} color="#FF4757" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < 10 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                <Ionicons name="add" size={20} color={ZaloColors.blue} />
                <Text style={styles.addOptionText}>Thêm phương án</Text>
              </TouchableOpacity>
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: ZaloColors.blue,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 8,
  },
  questionInput: {
    fontSize: 16,
    color: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    minHeight: 40,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionInputWrap: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  optionInput: {
    fontSize: 15,
    color: '#000',
  },
  removeBtn: {
    marginLeft: 10,
    padding: 4,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  addOptionText: {
    fontSize: 15,
    color: ZaloColors.blue,
    fontWeight: '600',
    marginLeft: 6,
  },
});
