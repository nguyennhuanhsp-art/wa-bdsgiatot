import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
@Catch()
export class FriendlyErrors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json(error.getResponse());
    const known: Record<string, string> = {
      "42501": "Bạn không có quyền thực hiện thao tác này.",
      "23505":
        "Thông tin hoặc phân công này đã tồn tại. Vui lòng kiểm tra lại.",
      "23503":
        "Thông tin liên kết chưa hợp lệ. Vui lòng chọn đúng dự án và combo.",
      "23514":
        "Thông tin chưa đáp ứng điều kiện. Hãy kiểm tra quyền dự án, hạn mức, trạng thái và ảnh của tin.",
      P0002: "Không tìm thấy thông tin hoặc lời mời đã không còn hợp lệ.",
    };
    if (known[error.code])
      return res
        .status(error.code === "42501" ? 403 : 400)
        .json({ message: known[error.code] });
    console.error("Request failed:", error.code || error.name, error.message);
    return res
      .status(500)
      .json({ message: "Chưa thực hiện được thao tác. Vui lòng thử lại sau." });
  }
}
