import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  TextInput,
  RefreshControl,
  Modal,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Interfaces ───────────────────────────────────────────────
interface Publisher {
  name: string;
  logo: string;
  verified: boolean;
}

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
}

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string[];
  imageUrl: string;
  category: string;
  publisher: Publisher;
  publishedAt: string;
  views: number;
  likes: number;
  commentsCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  commentsList: Comment[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const NEWS_CATEGORIES: Category[] = [
  { id: "all", name: "Tất cả", icon: "newspaper-outline" },
  { id: "hot", name: "Nóng 24h", icon: "flame-outline" },
  { id: "tech", name: "Công nghệ", icon: "phone-portrait-outline" },
  { id: "sports", name: "Thể thao", icon: "football-outline" },
  { id: "ent", name: "Giải trí", icon: "musical-notes-outline" },
  { id: "health", name: "Sức khỏe", icon: "heart-outline" },
  { id: "business", name: "Kinh doanh", icon: "trending-up-outline" },
];

const INITIAL_ARTICLES: Article[] = [
  {
    id: "art1",
    title: "Apple công bố chip M5 với hiệu năng siêu khủng, tập trung mạnh vào trí tuệ nhân tạo Apple Intelligence",
    excerpt: "Dòng chip thế hệ tiếp theo của Apple hứa hẹn sẽ thay đổi hoàn toàn cách người dùng tương tác với máy tính cá nhân nhờ tích hợp hàng tỷ bóng bán dẫn chuyên dụng cho AI.",
    content: [
      "Tại sự kiện WWDC diễn ra rạng sáng nay, Apple đã chính thức công bố thế hệ chip Silicon tiếp theo mang tên M5. Đây được coi là bước nhảy vọt lớn nhất của hãng trong vòng 3 năm qua, tập trung tối đa vào tối ưu hóa các mô hình ngôn ngữ lớn chạy trực tiếp trên thiết bị.",
      "Chip M5 được sản xuất trên tiến trình 3nm thế hệ thứ hai của TSMC, tích hợp hơn 150 tỷ bóng bán dẫn. Bộ xử lý thần kinh Neural Engine thế hệ mới có khả năng thực hiện tới 80 nghìn tỷ phép tính mỗi giây, nhanh gấp đôi so với thế hệ M4 hiện tại.",
      "Đại diện Apple cho biết, dòng chip mới này sẽ cho phép người dùng chạy các tác vụ AI phức tạp như tạo mã nguồn thời gian thực, xử lý video 8K tự động và dịch thuật song song ngoại tuyến mà không gặp bất kỳ độ trễ nào. Dự kiến dòng Macbook Pro và iPad Pro sử dụng chip M5 sẽ chính thức lên kệ vào cuối năm nay.",
      "Với việc ra mắt M5, Apple tiếp tục củng cố vị thế dẫn đầu trong kỷ nguyên máy tính tích hợp trí tuệ nhân tạo (AI PC), gây sức ép không nhỏ lên các đối thủ nặng ký như Intel, Qualcomm và AMD."
    ],
    imageUrl: "https://picsum.photos/seed/applem5/800/500",
    category: "tech",
    publisher: {
      name: "GenK - Tri thức công nghệ",
      logo: "https://picsum.photos/seed/genk/100/100",
      verified: true,
    },
    publishedAt: "30 phút trước",
    views: 12450,
    likes: 489,
    commentsCount: 3,
    isLiked: false,
    isBookmarked: false,
    commentsList: [
      {
        id: "c1_1",
        user: "Hoàng Long",
        avatar: "https://picsum.photos/seed/hl/100/100",
        text: "Hiệu năng thế này thì Intel lại mệt mỏi rồi. Mong chờ bản Macbook Air dùng chip M5 này quá!",
        time: "15 phút trước",
      },
      {
        id: "c1_2",
        user: "Minh Thư",
        avatar: "https://picsum.photos/seed/mt/100/100",
        text: "Apple Intelligence ngày càng thông minh, chạy offline hoàn toàn thì bảo mật tốt hơn hẳn.",
        time: "10 phút trước",
      },
      {
        id: "c1_3",
        user: "Khánh Trần",
        avatar: "https://picsum.photos/seed/kt/100/100",
        text: "Giá chắc chắn cũng sẽ rất 'khủng' tương đương hiệu năng thôi anh em à haha.",
        time: "5 phút trước",
      }
    ],
  },
  {
    id: "art2",
    title: "ĐT Việt Nam giành chiến thắng kịch tính 2-1 trước Thái Lan tại SVĐ Quốc gia Mỹ Đình",
    excerpt: "Trận cầu siêu kinh điển Đông Nam Á đã khép lại bằng một kịch bản không tưởng với bàn thắng quyết định được ghi ở những giây bù giờ cuối cùng.",
    content: [
      "Tối nay, chảo lửa Mỹ Đình đã thực sự bùng nổ khi Đội tuyển Quốc gia Việt Nam đón tiếp kình địch Thái Lan trong khuôn khổ trận chung kết giải vô địch Đông Nam Á. Trận đấu diễn ra vô cùng kịch tính và hấp dẫn đúng với kỳ vọng của người hâm mộ bóng đá khu vực.",
      "Việt Nam vươn lên dẫn trước từ khá sớm ở phút thứ 20 nhờ cú đánh đầu hiểm hóc của tiền đạo Nguyễn Tiến Linh sau đường tạt bóng chuẩn xác của Tuấn Anh. Tuy nhiên, sang hiệp 2, đội tuyển Thái Lan dồn lên tấn công mạnh mẽ và có bàn gỡ hòa ở phút 75 do công của Chanathip.",
      "Tưởng chừng như trận đấu sẽ kết thúc với tỷ số hòa thì bước ngoặt đã xảy ra ở phút bù giờ thứ 93. Từ quả đá phạt góc bên cánh trái, trung vệ Quế Ngọc Hải bật cao đánh đầu kiến tạo cho cầu thủ trẻ vừa vào sân thay người ghi bàn thắng quý hơn vàng, ấn định chiến thắng chung cuộc 2-1.",
      "Cả SVĐ Mỹ Đình như vỡ òa trong niềm vui sướng tột độ. Chiến thắng này giúp thầy trò huấn luyện viên trưởng đòi lại ngôi vương Đông Nam Á sau nhiều năm chờ đợi và khẳng định vị thế số một khu vực."
    ],
    imageUrl: "https://picsum.photos/seed/vietnamfootball/800/500",
    category: "sports",
    publisher: {
      name: "Báo Tuổi Trẻ",
      logo: "https://picsum.photos/seed/tuoitre/100/100",
      verified: true,
    },
    publishedAt: "1 giờ trước",
    views: 35600,
    likes: 2840,
    commentsCount: 2,
    isLiked: true,
    isBookmarked: false,
    commentsList: [
      {
        id: "c2_1",
        user: "Quốc Anh",
        avatar: "https://picsum.photos/seed/qa/100/100",
        text: "Tuyệt vời Việt Nam ơi!!! Xem mà tim muốn bắn ra ngoài luôn, Quế Ngọc Hải đá quá bản lĩnh!",
        time: "45 phút trước",
      },
      {
        id: "c2_2",
        user: "Hải Yến",
        avatar: "https://picsum.photos/seed/hy/100/100",
        text: "Chúc mừng đội tuyển! Cả đêm nay chắc cả nước đi bão ăn mừng mất thôi!",
        time: "30 phút trước",
      }
    ],
  },
  {
    id: "art3",
    title: "Sơn Tùng M-TP tiếp tục thiết lập kỷ lục thế giới mới với siêu phẩm âm nhạc ra mắt tối qua",
    excerpt: "MV âm nhạc mới nhất của nam ca sĩ gốc Thái Bình đã phá vỡ toàn bộ các kỷ lục lượt xem công chiếu trực tuyến và nhanh chóng leo lên top 1 thịnh hành tại nhiều quốc gia.",
    content: [
      "Đúng 20h00 tối qua, Sơn Tùng M-TP đã chính thức phát hành sản phẩm âm nhạc được mong chờ nhất năm. Chỉ sau vài phút công chiếu, sản phẩm đã nhanh chóng thu hút hàng triệu lượt xem trực tuyến đồng thời và trở thành chủ đề thảo luận sôi nổi trên khắp các mạng xã hội toàn cầu.",
      "Theo thống kê chính thức từ nền tảng, MV đã đạt cột mốc 10 triệu lượt xem chỉ sau vỏn vẹn 45 phút, thiết lập kỷ lục mới tại Đông Nam Á. Giai điệu bắt tai, phong cách thời trang dẫn đầu xu hướng cùng kỹ xảo điện ảnh đỉnh cao là những yếu tố tạo nên sự thành công vượt trội cho lần trở lại này.",
      "Không chỉ càn quét các bảng xếp hạng trong nước, siêu phẩm mới của Sơn Tùng còn lọt thẳng vào top trending âm nhạc của nhiều thị trường lớn như Mỹ, Nhật Bản, Hàn Quốc và Canada, minh chứng cho sức hút không biên giới của nam nghệ sĩ Việt Nam.",
      "Sự đầu tư bài bản và tư duy âm nhạc tiệm cận thế giới của Sơn Tùng M-TP một lần nữa chứng minh vị trí ngôi sao hạng A khó lòng thay thế của anh trong thị trường nhạc Việt hiện nay."
    ],
    imageUrl: "https://picsum.photos/seed/sontung/800/500",
    category: "ent",
    publisher: {
      name: "Kênh 14",
      logo: "https://picsum.photos/seed/kenh14/100/100",
      verified: false,
    },
    publishedAt: "2 giờ trước",
    views: 48900,
    likes: 5410,
    commentsCount: 2,
    isLiked: false,
    isBookmarked: true,
    commentsList: [
      {
        id: "c3_1",
        user: "Tuấn Kiệt",
        avatar: "https://picsum.photos/seed/tk/100/100",
        text: "Nhạc của Sơn Tùng luôn ở một đẳng cấp hoàn toàn khác biệt. Hình ảnh MV xuất sắc thực sự!",
        time: "1 giờ trước",
      },
      {
        id: "c3_2",
        user: "Phương Vy",
        avatar: "https://picsum.photos/seed/pv/100/100",
        text: "Nghe đi nghe lại từ tối qua tới giờ không biết chán luôn á mọi người ơi, nghiện mất rồi.",
        time: "50 phút trước",
      }
    ],
  },
  {
    id: "art4",
    title: "Xu hướng thị trường bất động sản cuối năm 2026: Dòng tiền đầu tư đang đổ về đâu?",
    excerpt: "Các chuyên gia kinh tế nhận định dòng tiền đang có xu hướng dịch chuyển mạnh mẽ sang các phân khúc bất động sản có tính thanh khoản cao và pháp lý minh bạch.",
    content: [
      "Báo cáo thị trường bất động sản mới nhất cho thấy sự phục hồi rõ nét trên toàn diện các phân khúc sau thời gian dài điều chỉnh. Tuy nhiên, hành vi của các nhà đầu tư cá nhân và tổ chức đã có những thay đổi mang tính chiến lược.",
      "Thay vì gom đất nền vùng ven chờ tăng giá như những chu kỳ trước, dòng tiền thông minh hiện tại ưu tiên lựa chọn các căn hộ chung cư thuộc phân khúc trung và cao cấp tại các đô thị lớn - nơi có nhu cầu thuê ở thực rất lớn và dòng tiền khai thác ổn định.",
      "Bên cạnh đó, các dự án bất động sản xanh, sinh thái vùng ven đô thị vệ tinh cũng ghi nhận mức độ quan tâm đột biến. Khách hàng ngày càng sẵn sàng chi trả mức giá cao hơn để sở hữu không gian sống trong lành, đầy đủ tiện ích và an toàn cho gia đình.",
      "Chuyên gia kinh tế khuyến cáo, trong giai đoạn hiện tại, yếu tố pháp lý vững chắc và uy tín chủ đầu tư là hai chiếc chìa khóa vàng giúp nhà đầu tư bảo toàn nguồn vốn và tối ưu hóa lợi nhuận trong dài hạn."
    ],
    imageUrl: "https://picsum.photos/seed/realestate/800/500",
    category: "business",
    publisher: {
      name: "Cafef - Tài chính kinh doanh",
      logo: "https://picsum.photos/seed/cafef/100/100",
      verified: true,
    },
    publishedAt: "4 giờ trước",
    views: 8900,
    likes: 215,
    commentsCount: 1,
    isLiked: false,
    isBookmarked: false,
    commentsList: [
      {
        id: "c4_1",
        user: "Trọng Nhân",
        avatar: "https://picsum.photos/seed/tn/100/100",
        text: "Hiện tại đúng là cứ pháp lý chuẩn, có sổ đỏ và vị trí tốt thì mới dám xuống tiền. An toàn là trên hết.",
        time: "2 giờ trước",
      }
    ],
  },
  {
    id: "art5",
    title: "5 thói quen đơn giản buổi sáng giúp tăng cường hệ miễn dịch và kéo dài tuổi thọ",
    excerpt: "Chỉ cần dành ra 15-20 phút thực hiện những thói quen lành mạnh này mỗi ngày, bạn sẽ thấy cơ thể khỏe khoắn và tràn đầy năng lượng tích cực.",
    content: [
      "Sức khỏe không đến từ những điều to tát mà tích lũy từ những thói quen nhỏ mỗi ngày. Bắt đầu buổi sáng đúng cách sẽ giúp kích hoạt hệ thống thải độc tự nhiên, tăng tốc độ trao đổi chất và củng cố hàng rào miễn dịch của cơ thể.",
      "Đầu tiên là uống một ly nước ấm ngay sau khi thức dậy. Thói quen này giúp bù đắp lượng nước mất đi sau đêm dài, đánh thức hệ tiêu hóa hoạt động và làm sạch đường ruột vô cùng hiệu quả.",
      "Thứ hai, thực hiện vài động tác giãn cơ nhẹ nhàng hoặc tập yoga từ 10-15 phút. Điều này kích thích tuần hoàn máu lưu thông tốt hơn, giảm đau mỏi xương khớp và tăng lượng oxy lên não giúp bạn tỉnh táo nhanh chóng.",
      "Thứ ba, không bao giờ bỏ qua bữa ăn sáng. Một bữa sáng giàu protein lành mạnh cùng chất xơ sẽ cung cấp năng lượng ổn định cho cả ngày dài làm việc, giữ cho lượng đường huyết ở mức cân bằng nhất.",
      "Cuối cùng, dành 5 phút tiếp xúc trực tiếp với ánh nắng mặt trời buổi sớm giúp cơ thể tự tổng hợp Vitamin D tự nhiên, cải thiện tâm trạng và giúp bạn dễ đi vào giấc ngủ ngon hơn vào buổi tối."
    ],
    imageUrl: "https://picsum.photos/seed/healthy/800/500",
    category: "health",
    publisher: {
      name: "Sức Khỏe & Đời Sống",
      logo: "https://picsum.photos/seed/healthlife/100/100",
      verified: true,
    },
    publishedAt: "5 giờ trước",
    views: 18700,
    likes: 830,
    commentsCount: 1,
    isLiked: false,
    isBookmarked: true,
    commentsList: [
      {
        id: "c5_1",
        user: "Mai Anh",
        avatar: "https://picsum.photos/seed/ma/100/100",
        text: "Uống cốc nước ấm buổi sáng thực sự rất tốt, mình duy trì thói quen này 2 năm nay và thấy da dẻ đẹp hẳn lên.",
        time: "3 giờ trước",
      }
    ],
  },
  {
    id: "art6",
    title: "Báo động đỏ: Mẹo phòng chống lừa đảo trực tuyến đang nở rộ trong không gian số",
    excerpt: "Cục An toàn thông tin phát đi cảnh báo về các chiêu trò lừa đảo công nghệ cao vô cùng tinh vi nhắm vào người dùng ví điện tử và tài khoản ngân hàng.",
    content: [
      "Thời gian gần đây, tình hình tội phạm công nghệ cao sử dụng các chiêu thức lừa đảo qua mạng xã hội và cuộc gọi mạo danh đang diễn biến hết sức phức tạp, gây thiệt hại lớn về tài sản cho người dân.",
      "Kịch bản phổ biến nhất là giả danh cán bộ công an, viện kiểm sát hoặc nhân viên tổng đài viễn thông gọi điện thông báo số thuê bao của nạn nhân liên quan đến vụ án ma túy hoặc rửa tiền. Đối tượng sau đó yêu cầu nạn nhân tải ứng dụng độc hại giả mạo để chiếm quyền điều khiển điện thoại hoặc chuyển tiền vào 'tài khoản an toàn' để kiểm tra.",
      "Một chiêu trò khác là gửi các đường link giả mạo chương trình trúng thưởng, tuyển cộng tác viên làm việc online nhẹ nhàng lương cao. Khi nạn nhân nhập thông tin đăng nhập và mã OTP ngân hàng vào các trang web giả này, tiền trong tài khoản lập tức bị bốc hơi.",
      "Cơ quan chức năng khuyến cáo người dân tuyệt đối không cung cấp thông tin cá nhân, số tài khoản, mật khẩu hoặc mã OTP cho bất kỳ ai. Các cơ quan tư pháp và ngân hàng không bao giờ làm việc qua điện thoại hay yêu cầu chuyển khoản tiền cá nhân của người dân."
    ],
    imageUrl: "https://picsum.photos/seed/cybersecurity/800/500",
    category: "hot",
    publisher: {
      name: "VnExpress",
      logo: "https://picsum.photos/seed/vnexpress/100/100",
      verified: true,
    },
    publishedAt: "6 giờ trước",
    views: 52100,
    likes: 1240,
    commentsCount: 2,
    isLiked: false,
    isBookmarked: false,
    commentsList: [
      {
        id: "c6_1",
        user: "Thế Vinh",
        avatar: "https://picsum.photos/seed/tv/100/100",
        text: "Mọi người nên lưu ý nhắc nhở bố mẹ, người lớn tuổi ở nhà nha. Người già rất dễ bị bọn này thao túng tâm lý qua điện thoại.",
        time: "4 giờ trước",
      },
      {
        id: "c6_2",
        user: "Bảo Trâm",
        avatar: "https://picsum.photos/seed/bt/100/100",
        text: "Công nghệ càng phát triển thì lừa đảo càng tinh vi. Cứ thấy đòi mã OTP hay bắt chuyển tiền là cúp máy ngay cho chắc ăn.",
        time: "3 giờ trước",
      }
    ],
  },
];

// ─── Format view count ─────────────────────────────────────────
const formatNumber = (num: number): string => {
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

export function NewsScreen({ onBack }: { onBack: () => void }) {
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [articles, setArticles] = useState<Article[]>(INITIAL_ARTICLES);
  const [refreshing, setRefreshing] = useState(false);
  
  // Active Article in Modal
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [newComment, setNewComment] = useState("");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  const handleToggleLike = (artId: string) => {
    setArticles((prev) =>
      prev.map((art) => {
        if (art.id === artId) {
          const updatedLiked = !art.isLiked;
          const updatedLikes = updatedLiked ? art.likes + 1 : art.likes - 1;
          const updatedArt = { ...art, isLiked: updatedLiked, likes: updatedLikes };
          // If this article is currently open in modal, sync it
          if (selectedArticle && selectedArticle.id === artId) {
            setSelectedArticle(updatedArt);
          }
          return updatedArt;
        }
        return art;
      })
    );
  };

  const handleToggleBookmark = (artId: string) => {
    setArticles((prev) =>
      prev.map((art) => {
        if (art.id === artId) {
          const updatedBookmark = !art.isBookmarked;
          const updatedArt = { ...art, isBookmarked: updatedBookmark };
          // If this article is currently open in modal, sync it
          if (selectedArticle && selectedArticle.id === artId) {
            setSelectedArticle(updatedArt);
          }
          return updatedArt;
        }
        return art;
      })
    );
  };

  const handleSendComment = () => {
    if (!newComment.trim() || !selectedArticle) return;

    const newCommentObj: Comment = {
      id: `c_user_${Date.now()}`,
      user: "Bạn (Người dùng)",
      avatar: "https://picsum.photos/seed/useravatar/100/100",
      text: newComment.trim(),
      time: "Vừa xong",
    };

    setArticles((prev) =>
      prev.map((art) => {
        if (art.id === selectedArticle.id) {
          const updatedComments = [newCommentObj, ...art.commentsList];
          const updatedArt = {
            ...art,
            commentsList: updatedComments,
            commentsCount: art.commentsCount + 1,
          };
          setSelectedArticle(updatedArt);
          return updatedArt;
        }
        return art;
      })
    );
    setNewComment("");
  };

  // Filter Articles
  const filteredArticles =
    activeCategory === "all"
      ? articles
      : activeCategory === "hot"
      ? articles.filter((a) => a.category === "hot" || a.views > 20000)
      : articles.filter((a) => a.category === activeCategory);

  const searchedArticles = searchText
    ? filteredArticles.filter(
        (art) =>
          art.title.toLowerCase().includes(searchText.toLowerCase()) ||
          art.excerpt.toLowerCase().includes(searchText.toLowerCase())
      )
    : filteredArticles;

  // Hot/Trending Carousel Items (Top 3 views)
  const hotArticles = articles
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0068FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tin Tức 24h</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tin tức, sự kiện mới..."
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")} activeOpacity={0.6}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0068FF"]}
            tintColor="#0068FF"
          />
        }
      >
        {/* Featured / Hot Carousel (Only show if no search is active) */}
        {!searchText && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={20} color="#FF3B30" />
              <Text style={styles.sectionTitle}>Tin nổi bật hôm nay</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={styles.hotScrollContent}
            >
              {hotArticles.map((art) => (
                <TouchableOpacity
                  key={art.id}
                  style={styles.hotCard}
                  activeOpacity={0.9}
                  onPress={() => setSelectedArticle(art)}
                >
                  <Image source={{ uri: art.imageUrl }} style={styles.hotImage} />
                  <View style={styles.hotOverlay} />
                  <View style={styles.hotBadge}>
                    <Text style={styles.hotBadgeText}>TIN HOT</Text>
                  </View>
                  <View style={styles.hotInfo}>
                    <View style={styles.pubRow}>
                      <Image source={{ uri: art.publisher.logo }} style={styles.pubLogoSmall} />
                      <Text style={styles.pubNameSmall}>{art.publisher.name}</Text>
                    </View>
                    <Text style={styles.hotTitle} numberOfLines={2}>
                      {art.title}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{art.publishedAt}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{formatNumber(art.views)} lượt xem</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {NEWS_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, isActive && styles.catChipActive]}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={isActive ? "#fff" : "#555"}
                  style={styles.catIcon}
                />
                <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* General News Feed */}
        <View style={styles.feedSection}>
          <Text style={styles.feedTitle}>
            {activeCategory === "all"
              ? "Tin tức mới nhất"
              : NEWS_CATEGORIES.find((c) => c.id === activeCategory)?.name || ""}
          </Text>

          {searchedArticles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={54} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy bài viết nào phù hợp</Text>
            </View>
          ) : (
            searchedArticles.map((art) => (
              <TouchableOpacity
                key={art.id}
                style={styles.artCard}
                activeOpacity={0.85}
                onPress={() => setSelectedArticle(art)}
              >
                <View style={styles.artBody}>
                  <View style={styles.artInfo}>
                    <View style={styles.artPubHeader}>
                      <Image source={{ uri: art.publisher.logo }} style={styles.pubLogoMini} />
                      <Text style={styles.pubNameMini}>{art.publisher.name}</Text>
                      {art.publisher.verified && (
                        <Ionicons name="checkmark-circle" size={13} color="#0068FF" />
                      )}
                    </View>
                    <Text style={styles.artTitle} numberOfLines={3}>
                      {art.title}
                    </Text>
                    <View style={styles.artFooter}>
                      <Text style={styles.artTime}>{art.publishedAt}</Text>
                      <View style={styles.artStats}>
                        <View style={styles.statIconItem}>
                          <Ionicons name="eye-outline" size={13} color="#888" />
                          <Text style={styles.statText}>{formatNumber(art.views)}</Text>
                        </View>
                        <View style={styles.statIconItem}>
                          <Ionicons name="heart-outline" size={13} color="#888" />
                          <Text style={styles.statText}>{art.likes}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Image source={{ uri: art.imageUrl }} style={styles.artThumbnail} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Detailed Article Modal ───────────────────────── */}
      <Modal
        visible={selectedArticle !== null}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setSelectedArticle(null)}
      >
        {selectedArticle && (
          <SafeAreaView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setSelectedArticle(null)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <View style={styles.modalHeaderPub}>
                <Image source={{ uri: selectedArticle.publisher.logo }} style={styles.pubLogoMini} />
                <Text style={styles.modalHeaderPubName} numberOfLines={1}>
                  {selectedArticle.publisher.name}
                </Text>
              </View>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity
                  onPress={() => handleToggleBookmark(selectedArticle.id)}
                  style={styles.modalHeaderActionBtn}
                >
                  <Ionicons
                    name={selectedArticle.isBookmarked ? "bookmark" : "bookmark-outline"}
                    size={22}
                    color={selectedArticle.isBookmarked ? "#0068FF" : "#333"}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalHeaderActionBtn}>
                  <Ionicons name="share-social-outline" size={22} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                {/* Banner Image */}
                <Image source={{ uri: selectedArticle.imageUrl }} style={styles.modalBanner} />

                {/* Article Content Area */}
                <View style={styles.modalBody}>
                  {/* Category Tag */}
                  <View style={styles.modalCategoryBadge}>
                    <Text style={styles.modalCategoryText}>
                      {NEWS_CATEGORIES.find((c) => c.id === selectedArticle.category)?.name || "Tin tức"}
                    </Text>
                  </View>

                  {/* Main Title */}
                  <Text style={styles.modalTitle}>{selectedArticle.title}</Text>

                  {/* Pub Info and Date */}
                  <View style={styles.modalPubDateRow}>
                    <Image source={{ uri: selectedArticle.publisher.logo }} style={styles.modalPubLogo} />
                    <View style={styles.modalPubMeta}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={styles.modalPubName}>{selectedArticle.publisher.name}</Text>
                        {selectedArticle.publisher.verified && (
                          <Ionicons name="checkmark-circle" size={14} color="#0068FF" />
                        )}
                      </View>
                      <Text style={styles.modalDateText}>Đăng lúc {selectedArticle.publishedAt}</Text>
                    </View>
                    
                    {/* Follow button style */}
                    <TouchableOpacity style={styles.modalFollowBtn} activeOpacity={0.8}>
                      <Text style={styles.modalFollowBtnText}>Theo dõi</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Excerpt */}
                  <Text style={styles.modalExcerpt}>{selectedArticle.excerpt}</Text>

                  <View style={styles.divider} />

                  {/* Content Paragraphs */}
                  {selectedArticle.content.map((paragraph, index) => (
                    <Text key={index} style={styles.modalParagraph}>
                      {paragraph}
                    </Text>
                  ))}

                  <View style={styles.divider} />

                  {/* Article Interaction Stats */}
                  <View style={styles.interactRow}>
                    <TouchableOpacity
                      style={[styles.interactButton, selectedArticle.isLiked && styles.interactButtonActive]}
                      onPress={() => handleToggleLike(selectedArticle.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={selectedArticle.isLiked ? "heart" : "heart-outline"}
                        size={20}
                        color={selectedArticle.isLiked ? "#FF3B30" : "#555"}
                      />
                      <Text style={[styles.interactText, selectedArticle.isLiked && styles.interactTextActive]}>
                        Thích ({selectedArticle.likes})
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.interactButton}>
                      <Ionicons name="eye-outline" size={20} color="#555" />
                      <Text style={styles.interactText}>{selectedArticle.views} lượt xem</Text>
                    </View>
                  </View>

                  {/* Comments Section Title */}
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentTitle}>Bình luận ({selectedArticle.commentsCount})</Text>
                  </View>

                  {/* Add Comment Input */}
                  <View style={styles.addCommentWrap}>
                    <Image
                      source={{ uri: "https://picsum.photos/seed/useravatar/100/100" }}
                      style={styles.myCommentAvatar}
                    />
                    <View style={styles.commentInputBox}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Chia sẻ ý kiến của bạn..."
                        placeholderTextColor="#999"
                        value={newComment}
                        onChangeText={setNewComment}
                        multiline
                      />
                      {newComment.trim().length > 0 && (
                        <TouchableOpacity
                          style={styles.sendCommentBtn}
                          onPress={handleSendComment}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="send" size={18} color="#0068FF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* List of Comments */}
                  <View style={styles.commentsList}>
                    {selectedArticle.commentsList.map((comm) => (
                      <View key={comm.id} style={styles.commentItem}>
                        <Image source={{ uri: comm.avatar }} style={styles.commentAvatar} />
                        <View style={styles.commentBubble}>
                          <View style={styles.commentUserRow}>
                            <Text style={styles.commentUserName}>{comm.user}</Text>
                            <Text style={styles.commentTime}>{comm.time}</Text>
                          </View>
                          <Text style={styles.commentText}>{comm.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
                
                <View style={{ height: 60 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0068FF",
    paddingTop: Platform.OS === "ios" ? 10 : 36,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },

  // Search
  searchWrap: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },

  // Featured Section
  featuredSection: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  hotScrollContent: {
    paddingHorizontal: 14,
    gap: 12,
  },
  hotCard: {
    width: SCREEN_WIDTH - 28,
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  hotImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  hotOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  hotBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hotBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  hotInfo: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  pubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  pubLogoSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  pubNameSmall: {
    color: "#e0e0e0",
    fontSize: 11,
    fontWeight: "600",
  },
  hotTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: "#ccc",
    fontSize: 11,
  },
  metaDot: {
    color: "#ccc",
    fontSize: 11,
  },

  // Category Selector
  categoryScroll: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    marginBottom: 8,
  },
  categoryContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E4E6EB",
  },
  catChipActive: {
    backgroundColor: "#0068FF",
    borderColor: "#0068FF",
  },
  catIcon: {
    marginRight: 2,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F5E71",
  },
  catChipTextActive: {
    color: "#fff",
  },

  // News Feed
  feedSection: {
    backgroundColor: "#fff",
    paddingVertical: 14,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  artCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  artBody: {
    flexDirection: "row",
    gap: 12,
  },
  artInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  artPubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  pubLogoMini: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#eee",
  },
  pubNameMini: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  artTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    lineHeight: 19,
    marginBottom: 6,
  },
  artFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  artTime: {
    fontSize: 11,
    color: "#888",
  },
  artStats: {
    flexDirection: "row",
    gap: 8,
  },
  statIconItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  statText: {
    fontSize: 11,
    color: "#888",
  },
  artThumbnail: {
    width: 100,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#eee",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
  },

  // ─── Modal Details Styles ──────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E6EB",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderPub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: SCREEN_WIDTH - 140,
  },
  modalHeaderPubName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalHeaderActionBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  modalBanner: {
    width: SCREEN_WIDTH,
    height: 220,
    resizeMode: "cover",
  },
  modalBody: {
    padding: 16,
  },
  modalCategoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 10,
  },
  modalCategoryText: {
    color: "#0068FF",
    fontSize: 11,
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    lineHeight: 28,
    marginBottom: 14,
  },
  modalPubDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalPubLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: "#eee",
  },
  modalPubMeta: {
    flex: 1,
  },
  modalPubName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  modalDateText: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  modalFollowBtn: {
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  modalFollowBtnText: {
    fontSize: 12,
    color: "#0068FF",
    fontWeight: "700",
  },
  modalExcerpt: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A4A4A",
    lineHeight: 22,
    fontStyle: "italic",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#E4E6EB",
    marginVertical: 14,
  },
  modalParagraph: {
    fontSize: 15,
    color: "#2C2C2C",
    lineHeight: 24,
    marginBottom: 14,
    textAlign: "justify",
  },

  // Interactions
  interactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F7F8FA",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  interactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  interactButtonActive: {
    transform: [{ scale: 1.02 }],
  },
  interactText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  interactTextActive: {
    color: "#FF3B30",
  },

  // Comments Section
  commentHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#E4E6EB",
    paddingBottom: 8,
    marginBottom: 12,
  },
  commentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  addCommentWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 10,
  },
  myCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eee",
  },
  commentInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 38,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    paddingVertical: 0,
    marginRight: 6,
  },
  sendCommentBtn: {
    padding: 4,
  },
  commentsList: {
    gap: 12,
  },
  commentItem: {
    flexDirection: "row",
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eee",
  },
  commentBubble: {
    flex: 1,
    backgroundColor: "#F0F2F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentUserRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },
  commentTime: {
    fontSize: 10,
    color: "#888",
  },
  commentText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 18,
  },
});
