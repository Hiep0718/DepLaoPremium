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
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="stats-chart" size={20} color={ZaloColors.blue} style={{ marginRight: 8 }} />
              <Text style={styles.title}>{initialData ? 'Chỉnh sửa bình chọn' : 'Tạo bình chọn'}</Text>
            </View>
            <TouchableOpacity onPress={handleCreate} style={styles.headerCreateBtn}>
              <Text style={styles.createBtnText}>{initialData ? 'Lưu' : 'Tạo'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.inputSection}>
              <Text style={styles.label}>CÂU HỎI BÌNH CHỌN</Text>
              <TextInput
                style={styles.questionInput}
                placeholder="Đặt câu hỏi bình chọn..."
                placeholderTextColor="#999"
                value={question}
                onChangeText={setQuestion}
                multiline
                autoFocus={!initialData}
              />
            </View>

            <View style={[styles.inputSection, { marginTop: 24 }]}>
              <Text style={styles.label}>CÁC PHƯƠNG ÁN</Text>
              {options.map((opt, idx) => (
                <View key={idx} style={styles.optionRow}>
                  <View style={styles.optionNumberWrap}>
                    <Text style={styles.optionNumber}>{idx + 1}</Text>
                  </View>
                  <View style={styles.optionInputWrap}>
                    <TextInput
                      style={styles.optionInput}
                      placeholder={`Phương án ${idx + 1}`}
                      placeholderTextColor="#bbb"
                      value={opt}
                      onChangeText={(val) => handleOptionChange(idx, val)}
                    />
                  </View>
                  {options.length > 2 && (
                    <TouchableOpacity 
                      onPress={() => handleRemoveOption(idx)}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF4757" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {options.length < 10 && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                  <Ionicons name="add-circle-outline" size={22} color={ZaloColors.blue} />
                  <Text style={styles.addOptionText}>Thêm phương án</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.footer}>
             <TouchableOpacity style={styles.submitBtn} onPress={handleCreate}>
               <Text style={styles.submitBtnText}>{initialData ? 'Cập nhật bình chọn' : 'Tạo bình chọn'}</Text>
             </TouchableOpacity>
          </View>
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
    backgroundColor: '#f9f9f9',
  },
  closeBtn: {
    padding: 4,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  headerCreateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: ZaloColors.blue,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputSection: {
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#777',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  questionInput: {
    fontSize: 18,
    color: '#000',
    borderBottomWidth: 1.5,
    borderBottomColor: ZaloColors.blue,
    paddingVertical: 12,
    minHeight: 50,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  optionNumberWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  optionNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
  },
  optionInputWrap: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  optionInput: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  removeBtn: {
    marginLeft: 12,
    padding: 4,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 10,
  },
  addOptionText: {
    fontSize: 15,
    color: ZaloColors.blue,
    fontWeight: '600',
    marginLeft: 10,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  submitBtn: {
    backgroundColor: ZaloColors.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: ZaloColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
